import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@vishanti/db';
import { prisma } from '../db';
import { ApiError } from '../errors';
import { computeAuditHash, GENESIS_HASH, type JsonValue } from './hash-chain';
import { transitionTicket } from './transition';

if (process.env.VISHANTI_TEST_DATABASE !== '1') {
  throw new Error('Run this test through npm test so it uses a temporary database');
}

const adminPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

let ticketId = '';
let petitionerId = '';
let officerId = '';

beforeAll(async () => {
  await prisma.$connect();
  await adminPrisma.$connect();

  const suffix = randomUUID();
  const petitioner = await prisma.user.create({
    data: {
      name: 'Concurrency test petitioner',
      email: 'petitioner-' + suffix + '@test.invalid',
      role: 'PETITIONER',
      tier: 0
    }
  });
  const officer = await prisma.user.create({
    data: {
      name: 'Concurrency test officer',
      email: 'officer-' + suffix + '@test.invalid',
      role: 'OFFICER_TIER_1',
      tier: 1
    }
  });
  petitionerId = petitioner.id;
  officerId = officer.id;

  const timestamp = new Date();
  const ticket = await prisma.ticket.create({
    data: {
      title: 'Concurrency transition fixture',
      description: 'This ticket exists only in a disposable concurrency test database.',
      category: 'ACADEMIC',
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      isAnonymous: false,
      petitionerId,
      assignedToId: officerId,
      currentTier: 1,
      version: 1
    }
  });
  ticketId = ticket.id;

  const payload = {
    status: 'ASSIGNED',
    category: 'ACADEMIC',
    priority: 'MEDIUM',
    isAnonymous: false,
    attachmentCount: 0
  };
  const hash = computeAuditHash({
    prevHash: GENESIS_HASH,
    seq: 0,
    ticketId,
    actorRef: petitionerId,
    type: 'CREATED',
    payload,
    timestamp
  });

  await prisma.auditEntry.create({
    data: {
      ticketId,
      seq: 0,
      type: 'CREATED',
      actorRef: petitionerId,
      payload,
      prevHash: GENESIS_HASH,
      hash,
      timestamp
    }
  });
});

afterAll(async () => {
  await adminPrisma.$disconnect();
  await prisma.$disconnect();
});

describe('TransitionService', () => {
  it('serializes ten concurrent transitions into one valid audit-chain update', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        transitionTicket({
          ticketId,
          toStatus: 'IN_REVIEW',
          actor: {
            kind: 'user',
            id: officerId,
            role: 'OFFICER_TIER_1',
            tier: 1
          },
          reason: 'The assigned officer has started reviewing this complaint.'
        })
      )
    );

    const successes = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const failures = attempts.filter((attempt) => attempt.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);
    const rejectedDetails = failures.map((attempt) =>
      attempt.status === 'rejected'
        ? {
            name: attempt.reason?.name,
            statusCode: attempt.reason?.statusCode,
            message: attempt.reason?.message
          }
        : null
    );
    expect(
      failures.every(
        (attempt) => attempt.status === 'rejected' &&
          attempt.reason instanceof ApiError &&
          attempt.reason.statusCode === 409
      ),
      JSON.stringify(rejectedDetails)
    ).toBe(true);

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.status).toBe('IN_REVIEW');
    expect(ticket.version).toBe(2);

    const entries = await prisma.auditEntry.findMany({
      where: { ticketId },
      orderBy: { seq: 'asc' }
    });
    expect(entries.map((entry) => entry.seq)).toEqual([0, 1]);
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[1].prevHash).toBe(entries[0].hash);

    for (const [index, entry] of entries.entries()) {
      expect(
        computeAuditHash({
          prevHash: entry.prevHash,
          seq: entry.seq,
          ticketId: entry.ticketId,
          actorRef: entry.actorRef,
          type: entry.type,
          payload: entry.payload as JsonValue,
          timestamp: entry.timestamp
        })
      ).toBe(entry.hash);
      if (index > 0) expect(entry.seq).toBe(entries[index - 1].seq + 1);
    }
  });
});

describe('append-only audit database permissions', () => {
  it('blocks update and delete through the runtime app_user connection', async () => {
    await expect(
      prisma.$executeRaw`
        UPDATE public."audit_entries"
        SET "type" = 'TAMPERED'
        WHERE "ticketId" = ${ticketId} AND "seq" = 0
      `
    ).rejects.toThrow();

    await expect(
      prisma.$executeRaw`
        DELETE FROM public."audit_entries"
        WHERE "ticketId" = ${ticketId} AND "seq" = 0
      `
    ).rejects.toThrow();
  });

  it('uses database triggers to block owner update, delete, and truncate', async () => {
    await expect(
      adminPrisma.$executeRaw`
        UPDATE public."audit_entries"
        SET "type" = 'TAMPERED'
        WHERE "ticketId" = ${ticketId} AND "seq" = 0
      `
    ).rejects.toThrow(/append-only/i);

    await expect(
      adminPrisma.$executeRaw`
        DELETE FROM public."audit_entries"
        WHERE "ticketId" = ${ticketId} AND "seq" = 0
      `
    ).rejects.toThrow(/append-only/i);

    await expect(
      adminPrisma.$executeRaw`TRUNCATE TABLE public."audit_entries"`
    ).rejects.toThrow(/append-only/i);
  });
});
