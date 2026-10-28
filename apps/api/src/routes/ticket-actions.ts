import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AddCommentSchema,
  DisputeTicketSchema,
  TransitionTicketSchema,
  type Role
} from '@vishanti/shared';
import { prisma } from '../db';
import { redis } from '../redis';
import { ApiError } from '../errors';
import { readBearerToken } from '../auth/service';
import {
  beginIdempotentRequest,
  finishIdempotentRequest,
  fingerprintRequest,
  releaseIdempotentRequest
} from '../services/idempotency';
import type { JsonValue } from '../services/hash-chain';
import {
  addTicketComment,
  disputeTicket,
  transitionTicket
} from '../services/transition';
import type { UserActor } from '../services/ticket-access';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function getTicketId(request: FastifyRequest): string {
  const id = (request.params as { id?: unknown }).id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new ApiError(400, 'Ticket ID must be a valid UUID');
  }
  return id;
}

async function getActor(request: FastifyRequest, required: boolean): Promise<UserActor | null> {
  const claims = await readBearerToken(request.headers.authorization);
  if (!claims) {
    if (required) throw new ApiError(401, 'Sign in to perform this action');
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.id },
    select: { id: true, role: true, tier: true }
  });
  if (!user) throw new ApiError(401, 'The account for this token no longer exists');

  return { kind: 'user', id: user.id, role: user.role as Role, tier: user.tier };
}

function receiptHeader(request: FastifyRequest): string | undefined {
  const value = request.headers['x-receipt-secret'];
  return Array.isArray(value) ? value[0] : value;
}

function receiptFingerprint(secret?: string): string | null {
  if (!secret) return null;
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

async function sendIdempotently(
  request: FastifyRequest,
  reply: FastifyReply,
  scope: string,
  fingerprintValue: JsonValue,
  statusCode: number,
  action: () => Promise<unknown>
): Promise<FastifyReply> {
  const header = request.headers['idempotency-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key || !IDEMPOTENCY_PATTERN.test(key)) {
    throw new ApiError(400, 'Send a valid Idempotency-Key header');
  }

  const start = await beginIdempotentRequest(
    redis,
    scope,
    key,
    fingerprintRequest(fingerprintValue)
  );
  if (start.replay) {
    return reply.code(start.statusCode).send(start.body);
  }

  try {
    const body = { success: true, data: await action() };
    await finishIdempotentRequest(redis, start.lease, statusCode, body);
    return reply.code(statusCode).send(body);
  } catch (error) {
    await releaseIdempotentRequest(redis, start.lease);
    throw error;
  }
}

export async function registerTicketActionRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/api/tickets/:id/transition', async (request, reply) => {
    const ticketId = getTicketId(request);
    const parsed = TransitionTicketSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid transition details',
        errors: parsed.error.issues
      });
    }

    const actor = await getActor(request, true);
    if (!actor) throw new ApiError(401, 'Sign in to transition a ticket');

    return sendIdempotently(
      request,
      reply,
      'ticket-transition:' + ticketId + ':' + actor.id,
      { ticketId, ...parsed.data } as JsonValue,
      200,
      () => transitionTicket({ ticketId, actor, ...parsed.data })
    );
  });

  app.post('/api/tickets/:id/comments', async (request, reply) => {
    const ticketId = getTicketId(request);
    const parsed = AddCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid comment details',
        errors: parsed.error.issues
      });
    }

    const actor = await getActor(request, false);
    const receiptSecret = receiptHeader(request);

    return sendIdempotently(
      request,
      reply,
      'ticket-comment:' + ticketId + ':' + (actor?.id ?? 'receipt'),
      {
        ticketId,
        content: parsed.data.content,
        isInternal: parsed.data.isInternal,
        receiptFingerprint: receiptFingerprint(receiptSecret)
      },
      201,
      () => addTicketComment({
        ticketId,
        actor,
        receiptSecret,
        content: parsed.data.content,
        isInternal: parsed.data.isInternal
      })
    );
  });

  app.post('/api/tickets/:id/dispute', async (request, reply) => {
    const ticketId = getTicketId(request);
    const parsed = DisputeTicketSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid dispute details',
        errors: parsed.error.issues
      });
    }

    const actor = await getActor(request, false);
    return sendIdempotently(
      request,
      reply,
      'ticket-dispute:' + ticketId + ':' + (actor?.id ?? 'receipt'),
      {
        ticketId,
        disputeReason: parsed.data.disputeReason,
        receiptFingerprint: receiptFingerprint(parsed.data.receiptSecret)
      },
      200,
      () => disputeTicket({
        ticketId,
        actor,
        receiptSecret: parsed.data.receiptSecret,
        disputeReason: parsed.data.disputeReason
      })
    );
  });
}
