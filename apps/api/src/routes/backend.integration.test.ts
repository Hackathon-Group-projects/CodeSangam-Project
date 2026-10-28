import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import { redis } from '../redis';
import { ApiError } from '../errors';
import { registerAuthRoutes } from '../auth/routes';
import { createAccessToken } from '../auth/service';
import { registerTicketRoutes } from './tickets';
import { registerTicketActionRoutes } from './ticket-actions';
import { transitionTicket } from '../services/transition';
import { computeAuditHash, GENESIS_HASH, type JsonValue } from '../services/hash-chain';
import { startNotificationHub, stopNotificationHub } from '../services/notifications';

if (process.env.VISHANTI_TEST_DATABASE !== '1') {
  throw new Error('Run this test through npm test so it uses a temporary database');
}

let app: FastifyInstance;
let baseUrl = '';
const sockets: Socket[] = [];

function testKey(): string {
  return 'test-' + randomUUID();
}

async function postTicket(token: string | undefined, isAnonymous: boolean, idempotencyKey = testKey()) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/tickets',
    headers: {
      'idempotency-key': idempotencyKey,
      ...(token ? { authorization: 'Bearer ' + token } : {})
    },
    payload: {
      title: 'Integration test grievance',
      description: 'A sufficiently detailed description for a backend integration test.',
      category: 'ACADEMIC',
      priority: 'MEDIUM',
      isAnonymous,
      attachments: []
    }
  });
  return response;
}

async function transition(
  ticketId: string,
  token: string,
  body: { toStatus: 'IN_REVIEW' | 'RESOLVED'; reason?: string; resolutionNote?: string }
) {
  return app.inject({
    method: 'PATCH',
    url: '/api/tickets/' + ticketId + '/transition',
    headers: { authorization: 'Bearer ' + token, 'idempotency-key': testKey() },
    payload: body
  });
}

async function connectAndJoin(token: string, ticketId: string): Promise<Socket> {
  const socket = connectSocket(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000
  });
  sockets.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });

  const joined = await new Promise<{ success: boolean }>((resolve) => {
    socket.emit('ticket:join', { ticketId }, resolve);
  });
  expect(joined.success).toBe(true);
  const legacyDashboardJoined = await new Promise<{ success: boolean }>((resolve) => {
    socket.emit('ticket:subscribe', { ticketId }, resolve);
  });
  expect(legacyDashboardJoined.success).toBe(true);
  return socket;
}

function nextSocketEvent(socket: Socket, eventName: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for ' + eventName)), 3000);
    socket.once(eventName, (event: Record<string, unknown>) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
}

beforeAll(async () => {
  if (redis.status === 'wait') await redis.connect();

  app = Fastify();
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ success: false, message: error.message });
    }
    request.log.error({ err: error }, 'Integration request failed');
    return reply.code(500).send({ success: false, message: 'Request failed' });
  });

  await registerAuthRoutes(app);
  await registerTicketRoutes(app);
  await registerTicketActionRoutes(app);
  await startNotificationHub(app.server);
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
}, 20_000);

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await stopNotificationHub();
  await app?.close().catch(() => undefined);
  redis.disconnect();
  await prisma.$disconnect();
});

describe('Phase 2 and Phase 3 HTTP and Socket.IO integration', () => {
  it('registers, files, transitions, comments, disputes, and emits after commit', async () => {
    const suffix = randomUUID();
    const registration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Integration Petitioner',
        email: 'petitioner-' + suffix + '@test.invalid',
        password: 'A-secure-test-password-2026',
        role: 'ADMIN'
      }
    });
    expect(registration.statusCode).toBe(201);
    const registrationBody = registration.json();
    expect(registrationBody.data.user.role).toBe('PETITIONER');
    const petitionerToken = registrationBody.data.token as string;

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'petitioner-' + suffix + '@test.invalid',
        password: 'A-secure-test-password-2026'
      }
    });
    expect(login.statusCode).toBe(200);
    const loginToken = login.json().data.token as string;

    const officer = await prisma.user.create({
      data: {
        name: 'Integration Officer',
        email: 'officer-' + suffix + '@test.invalid',
        role: 'OFFICER_TIER_1',
        tier: 1
      }
    });
    const officerToken = await createAccessToken({
      id: officer.id,
      role: officer.role,
      tier: officer.tier
    });

    const filingKey = testKey();
    const signedTicketResponse = await postTicket(loginToken, false, filingKey);
    expect(signedTicketResponse.statusCode).toBe(201);
    const signedTicketBody = signedTicketResponse.json();
    const ticketId = signedTicketBody.data.ticket.id as string;
    expect(signedTicketBody.data.ticket.status).toBe('FILED');
    const duplicateFiling = await postTicket(loginToken, false, filingKey);
    expect(duplicateFiling.statusCode).toBe(201);
    expect(duplicateFiling.json().data.ticket.id).toBe(ticketId);

    await transitionTicket({
      ticketId,
      toStatus: 'ASSIGNED',
      actor: { kind: 'system', id: 'test-triage' },
      assignedToId: officer.id
    });

    const unauthorizedTransition = await transition(ticketId, petitionerToken, {
      toStatus: 'IN_REVIEW',
      reason: 'A review note long enough for the request.'
    });
    expect(unauthorizedTransition.statusCode).toBe(403);

    const officerSocket = await connectAndJoin(officerToken, ticketId);
    const updateEvent = nextSocketEvent(officerSocket, 'ticket:updated');
    const dashboardUpdateEvent = nextSocketEvent(officerSocket, 'ticket-updated');
    const review = await transition(ticketId, officerToken, {
      toStatus: 'IN_REVIEW',
      reason: 'The officer has started the detailed review.'
    });
    expect(review.statusCode).toBe(200);
    expect(review.json().data.ticket.status).toBe('IN_REVIEW');
    expect((await updateEvent).status).toBe('IN_REVIEW');
    const dashboardEvent = await dashboardUpdateEvent;
    expect(dashboardEvent.status).toBe('IN_REVIEW');
    expect(dashboardEvent.type).toBe('IN_REVIEW');

    const internalComment = await app.inject({
      method: 'POST',
      url: '/api/tickets/' + ticketId + '/comments',
      headers: { authorization: 'Bearer ' + officerToken, 'idempotency-key': testKey() },
      payload: { content: 'Internal review note for staff only.', isInternal: true }
    });
    expect(internalComment.statusCode).toBe(201);

    const resolution = await transition(ticketId, officerToken, {
      toStatus: 'RESOLVED',
      resolutionNote: 'The reported issue has been reviewed and corrective action is recorded.'
    });
    expect(resolution.statusCode).toBe(200);
    expect(resolution.json().data.ticket.status).toBe('RESOLVED');

    const publicComment = await app.inject({
      method: 'POST',
      url: '/api/tickets/' + ticketId + '/comments',
      headers: { authorization: 'Bearer ' + petitionerToken, 'idempotency-key': testKey() },
      payload: { content: 'Thank you for the update.', isInternal: false }
    });
    expect(publicComment.statusCode).toBe(201);

    const dispute = await app.inject({
      method: 'POST',
      url: '/api/tickets/' + ticketId + '/dispute',
      headers: { authorization: 'Bearer ' + petitionerToken, 'idempotency-key': testKey() },
      payload: { disputeReason: 'The resolution does not address the original concern.' }
    });
    expect(dispute.statusCode).toBe(200);
    expect(dispute.json().data.ticket.status).toBe('ESCALATED');
    expect(dispute.json().data.ticket.currentTier).toBe(2);

    const anonymousResponse = await postTicket(undefined, true);
    expect(anonymousResponse.statusCode).toBe(201);
    const anonymousData = anonymousResponse.json().data;
    const anonymousId = anonymousData.ticket.id as string;
    const receiptSecret = anonymousData.receiptSecret as string;
    expect(receiptSecret).toMatch(/^[0-9a-f]{64}$/);

    const invalidReceiptComment = await app.inject({
      method: 'POST',
      url: '/api/tickets/' + anonymousId + '/comments',
      headers: {
        'idempotency-key': testKey(),
        'x-receipt-secret': 'f'.repeat(64)
      },
      payload: { content: 'This comment uses the wrong receipt.', isInternal: false }
    });
    expect(invalidReceiptComment.statusCode).toBe(403);

    const anonymousComment = await app.inject({
      method: 'POST',
      url: '/api/tickets/' + anonymousId + '/comments',
      headers: {
        'idempotency-key': testKey(),
        'x-receipt-secret': receiptSecret
      },
      payload: { content: 'An anonymous petitioner clarification.', isInternal: false }
    });
    expect(anonymousComment.statusCode).toBe(201);

    await transitionTicket({
      ticketId: anonymousId,
      toStatus: 'ASSIGNED',
      actor: { kind: 'system', id: 'test-triage' },
      assignedToId: officer.id
    });
    const anonymousReview = await transition(anonymousId, officerToken, {
      toStatus: 'IN_REVIEW',
      reason: 'The officer has started the detailed review.'
    });
    expect(anonymousReview.statusCode).toBe(200);
    const anonymousResolution = await transition(anonymousId, officerToken, {
      toStatus: 'RESOLVED',
      resolutionNote: 'The reported issue has been reviewed and corrective action is recorded.'
    });
    expect(anonymousResolution.statusCode).toBe(200);

    const anonymousDispute = await app.inject({
      method: 'POST',
      url: '/api/tickets/' + anonymousId + '/dispute',
      headers: { 'idempotency-key': testKey() },
      payload: {
        disputeReason: 'The resolution does not address the original concern.',
        receiptSecret
      }
    });
    expect(anonymousDispute.statusCode).toBe(200);
    expect(anonymousDispute.json().data.ticket.currentTier).toBe(2);

    const entries = await prisma.auditEntry.findMany({
      where: { ticketId },
      orderBy: { seq: 'asc' }
    });
    expect(entries.map((entry) => entry.type)).toEqual([
      'CREATED',
      'ASSIGNED',
      'IN_REVIEW',
      'COMMENTED',
      'RESOLVED',
      'COMMENTED',
      'DISPUTED'
    ]);
    let previousHash = GENESIS_HASH;
    for (const [index, entry] of entries.entries()) {
      expect(entry.seq).toBe(index);
      expect(entry.prevHash).toBe(previousHash);
      expect(entry.hash).toBe(computeAuditHash({
        prevHash: entry.prevHash,
        seq: entry.seq,
        ticketId: entry.ticketId,
        actorRef: entry.actorRef,
        type: entry.type,
        payload: entry.payload as JsonValue,
        timestamp: entry.timestamp
      }));
      previousHash = entry.hash;
    }
  }, 30_000);
});
