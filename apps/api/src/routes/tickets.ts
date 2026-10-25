import { createHmac, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CreateTicketSchema,
  type CreateTicketInput
} from '@vishanti/shared';
import type { JsonValue } from '../services/hash-chain';
import { computeAuditHash, GENESIS_HASH } from '../services/hash-chain';
import {
  beginIdempotentRequest,
  finishIdempotentRequest,
  fingerprintRequest,
  releaseIdempotentRequest,
  type IdempotencyLease
} from '../services/idempotency';
import { prisma } from '../db';
import { redis } from '../redis';
import { config } from '../config';
import { ApiError } from '../errors';
import { readBearerToken } from '../auth/service';

interface TicketRequestContext {
  input: CreateTicketInput;
  petitionerId: string | null;
  start: Awaited<ReturnType<typeof beginIdempotentRequest>>;
}

type RequestWithTicketContext = FastifyRequest & { ticketContext?: TicketRequestContext };

function requestContext(request: FastifyRequest): RequestWithTicketContext {
  return request as RequestWithTicketContext;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validateAttachmentMetadata(input: CreateTicketInput): string | null {
  for (const attachment of input.attachments) {
    if (!attachment.fileName.trim() || attachment.fileName.length > 255) return 'Attachment file name is invalid';
    if (!attachment.storageKey.trim()) return 'Attachment storage key is required';
    if (!attachment.mimeType.trim() || attachment.mimeType.length > 128) return 'Attachment MIME type is invalid';
    if (!Number.isInteger(attachment.fileSize) || attachment.fileSize < 0 || attachment.fileSize > 10 * 1024 * 1024) {
      return 'Attachment size must be between 0 and 10 MB';
    }
    if (!/^[0-9a-f]{64}$/.test(attachment.sha256Hash)) return 'Attachment SHA-256 must be 64 lowercase hex characters';
  }
  return null;
}

async function prepareTicketRequest(request: FastifyRequest, reply: FastifyReply) {
  const parsed = CreateTicketSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ success: false, message: 'Invalid ticket details', errors: parsed.error.issues });
  }

  const input = parsed.data;
  const attachmentError = validateAttachmentMetadata(input);
  if (attachmentError) return reply.code(400).send({ success: false, message: attachmentError });

  let petitionerId: string | null = null;
  let scope = 'ticket-create:anonymous';

  // An anonymous submission intentionally does not use an account identity.
  if (!input.isAnonymous) {
    const tokenUser = await readBearerToken(request.headers.authorization);
    if (!tokenUser) throw new ApiError(401, 'Sign in to submit a non-anonymous ticket');

    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
      select: { id: true, role: true }
    });
    if (!user) throw new ApiError(401, 'The account for this token no longer exists');
    if (user.role !== 'PETITIONER') throw new ApiError(403, 'Only petitioner accounts can file tickets');
    petitionerId = user.id;
    scope = `ticket-create:user:${user.id}`;
  }

  const keyHeader = request.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return reply.code(400).send({
      success: false,
      message: 'Send an Idempotency-Key between 8 and 128 letters, numbers, dots, underscores, colons, or hyphens'
    });
  }

  const start = await beginIdempotentRequest(
    redis,
    scope,
    idempotencyKey,
    fingerprintRequest(input as unknown as JsonValue)
  );

  requestContext(request).ticketContext = { input, petitionerId, start };
}

export async function registerTicketRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/tickets', { preHandler: prepareTicketRequest }, async (request, reply) => {
    const context = requestContext(request).ticketContext;
    if (!context) throw new ApiError(500, 'Ticket request was not prepared');

    if (context.start.replay) {
      return reply.code(context.start.statusCode).send(context.start.body);
    }

    const lease: IdempotencyLease = context.start.lease;
    const input = context.input;
    const ticketId = randomUUID();
    const timestamp = new Date();
    const receiptSecret = input.isAnonymous ? randomBytes(32).toString('hex') : undefined;
    const receiptHash = receiptSecret ? sha256(receiptSecret) : null;
    const petitionerRef = receiptSecret
      ? createHmac('sha256', config.hmacSecret).update(ticketId, 'utf8').digest('hex')
      : null;
    const actorRef = petitionerRef ?? context.petitionerId;

    if (!actorRef) {
      await releaseIdempotentRequest(redis, lease);
      throw new ApiError(401, 'A ticket must have an authenticated petitioner or an anonymous receipt');
    }

    try {
      const auditPayload = {
        status: 'FILED',
        category: input.category,
        priority: input.priority,
        isAnonymous: input.isAnonymous,
        attachmentCount: input.attachments.length
      };

      const ticket = await prisma.$transaction(async (transaction) => {
        const created = await transaction.ticket.create({
          data: {
            id: ticketId,
            title: input.title,
            description: input.description,
            category: input.category,
            priority: input.priority,
            status: 'FILED',
            isAnonymous: input.isAnonymous,
            receiptHash,
            petitionerRef,
            petitionerId: context.petitionerId,
            currentTier: 1,
            version: 1,
            createdAt: timestamp,
            attachments: {
              create: input.attachments.map((attachment) => ({
                fileName: attachment.fileName,
                storageKey: attachment.storageKey,
                sha256Hash: attachment.sha256Hash,
                mimeType: attachment.mimeType,
                fileSize: attachment.fileSize
              }))
            }
          },
          select: {
            id: true,
            title: true,
            category: true,
            priority: true,
            status: true,
            isAnonymous: true,
            version: true,
            createdAt: true
          }
        });

        const hash = computeAuditHash({
          prevHash: GENESIS_HASH,
          seq: 0,
          ticketId,
          actorRef,
          type: 'CREATED',
          payload: auditPayload,
          timestamp
        });

        await transaction.auditEntry.create({
          data: {
            ticketId,
            seq: 0,
            type: 'CREATED',
            actorRef,
            payload: auditPayload,
            prevHash: GENESIS_HASH,
            hash,
            timestamp
          }
        });

        return created;
      });

      const body = {
        success: true,
        data: {
          ticket,
          ...(receiptSecret ? { receiptSecret } : {})
        }
      };

      await finishIdempotentRequest(redis, lease, 201, body);
      return reply.code(201).send(body);
    } catch (error) {
      await releaseIdempotentRequest(redis, lease);
      throw error;
    }
  });
}
