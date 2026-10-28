import { ALLOWED_TRANSITIONS, DEFAULT_SLA_POLICY, DISPUTE_WINDOW_MS } from '@vishanti/shared';
import type { Priority, Role, Status } from '@vishanti/shared';
import { Prisma } from '@vishanti/db';
import type { Ticket } from '@vishanti/db';
import { prisma } from '../db';
import { ApiError } from '../errors';
import { computeAuditHash, type JsonValue } from './hash-chain';
import {
  actorReference,
  isTicketAuthority,
  verifyReceiptSecret,
  type TicketAccessDetails,
  type TicketActor,
  type UserActor
} from './ticket-access';
import { publishTicketComment, publishTicketUpdate } from './notifications';

const ROLE_FOR_TIER: Record<number, Role> = {
  1: 'OFFICER_TIER_1',
  2: 'COMMITTEE_TIER_2',
  3: 'OMBUDSMAN_TIER_3'
};

const SYSTEM_TRANSITIONS: Array<[Status, Status]> = [
  ['FILED', 'ASSIGNED'],
  ['ASSIGNED', 'ESCALATED'],
  ['IN_REVIEW', 'ESCALATED'],
  ['ESCALATED', 'ASSIGNED']
];

export interface TransitionInput {
  ticketId: string;
  toStatus: Status;
  actor: UserActor | { kind: 'system'; id?: string };
  reason?: string;
  resolutionNote?: string;
  assignedToId?: string;
}

export interface CommentInput {
  ticketId: string;
  actor: UserActor | null;
  receiptSecret?: string;
  content: string;
  isInternal: boolean;
}

export interface DisputeInput {
  ticketId: string;
  actor: UserActor | null;
  receiptSecret?: string;
  disputeReason: string;
}

interface PublicAuditSummary {
  ticketId: string;
  seq: number;
  type: string;
  hash: string;
  timestamp: Date;
}

type LockedTicket = Ticket & TicketAccessDetails;

/**
 * Normal transitions require the staff role that matches the ticket's authority tier.
 * Assignment and SLA escalation transitions are reserved for worker calls.
 */
export function canTransition(role: Role, tier: number, from: Status, to: Status): boolean {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) return false;
  if (to !== 'IN_REVIEW' && to !== 'RESOLVED') return false;
  if (role === 'ADMIN') return true;
  return ROLE_FOR_TIER[tier] === role;
}

async function lockTicket(
  transaction: Prisma.TransactionClient,
  ticketId: string
): Promise<LockedTicket> {
  const locked = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM public."tickets"
    WHERE "id" = ${ticketId}
    FOR UPDATE
  `;

  if (locked.length === 0) throw new ApiError(404, 'Ticket was not found');

  const ticket = await transaction.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new ApiError(404, 'Ticket was not found');
  return ticket;
}

async function appendAuditEntry(
  transaction: Prisma.TransactionClient,
  ticket: Ticket,
  actorRef: string,
  type: string,
  payload: JsonValue,
  timestamp: Date
): Promise<PublicAuditSummary> {
  const previous = await transaction.auditEntry.findFirst({
    where: { ticketId: ticket.id },
    orderBy: { seq: 'desc' },
    select: { seq: true, hash: true }
  });

  if (!previous) throw new ApiError(500, 'The ticket audit chain is missing its first entry');

  const seq = previous.seq + 1;
  const hash = computeAuditHash({
    prevHash: previous.hash,
    seq,
    ticketId: ticket.id,
    actorRef,
    type,
    payload,
    timestamp
  });

  await transaction.auditEntry.create({
    data: {
      ticketId: ticket.id,
      seq,
      actorRef,
      type,
      payload: payload as Prisma.InputJsonValue,
      prevHash: previous.hash,
      hash,
      timestamp
    }
  });

  return { ticketId: ticket.id, seq, type, hash, timestamp };
}

async function getSlaDueAt(
  transaction: Prisma.TransactionClient,
  priority: Priority,
  tier: number,
  timestamp: Date
): Promise<Date> {
  const policy = await transaction.slaPolicy.findUnique({ where: { priority } });
  const defaultMinutes = DEFAULT_SLA_POLICY[priority].resolveHours * 60;
  const resolveMinutes = policy?.tier === tier ? policy.resolveMins : defaultMinutes;
  return new Date(timestamp.getTime() + resolveMinutes * 60_000);
}

function isSystemTransition(from: Status, to: Status): boolean {
  return SYSTEM_TRANSITIONS.some(([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to);
}

export async function transitionTicket(input: TransitionInput) {
  if (input.reason && input.reason.trim().length > 500) {
    throw new ApiError(400, 'Transition reason cannot exceed 500 characters');
  }
  if (input.toStatus === 'IN_REVIEW' && (!input.reason || input.reason.trim().length < 10)) {
    throw new ApiError(400, 'A review note of at least 10 characters is required');
  }
  if (input.resolutionNote && (input.resolutionNote.trim().length < 10 || input.resolutionNote.length > 5000)) {
    throw new ApiError(400, 'Resolution note must be between 10 and 5000 characters');
  }
  if (input.toStatus === 'RESOLVED' && !input.resolutionNote?.trim()) {
    throw new ApiError(400, 'A resolution note is required to resolve a ticket');
  }

  const result = await prisma.$transaction(async (transaction) => {
    const ticket = await lockTicket(transaction, input.ticketId);
    const fromStatus = ticket.status as Status;

    if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(input.toStatus)) {
      throw new ApiError(409, 'This ticket cannot move from its current status to the requested status');
    }

    if (input.actor.kind === 'system') {
      if (!isSystemTransition(fromStatus, input.toStatus)) {
        throw new ApiError(403, 'The system cannot perform this transition');
      }
    } else {
      if (
        (input.actor.role !== 'ADMIN' && input.actor.tier !== ticket.currentTier) ||
        !canTransition(input.actor.role, input.actor.tier, fromStatus, input.toStatus)
      ) {
        throw new ApiError(403, 'Your role cannot make this transition for the ticket current tier');
      }

      if (!isTicketAuthority(ticket, input.actor)) {
        throw new ApiError(403, 'This ticket is assigned to another authority');
      }
    }

    const timestamp = new Date();
    let currentTier = ticket.currentTier;
    let slaDueAt = ticket.slaDueAt;

    if (input.toStatus === 'ESCALATED') {
      if (currentTier >= 3) throw new ApiError(409, 'This ticket is already at the highest authority tier');
      currentTier += 1;
      slaDueAt = await getSlaDueAt(transaction, ticket.priority as Priority, currentTier, timestamp);
    } else if (input.toStatus === 'ASSIGNED' && fromStatus === 'FILED') {
      slaDueAt = await getSlaDueAt(transaction, ticket.priority as Priority, currentTier, timestamp);
    } else if (input.toStatus === 'RESOLVED') {
      slaDueAt = null;
    }

    if (input.assignedToId) {
      const assignee = await transaction.user.findUnique({
        where: { id: input.assignedToId },
        select: { id: true, role: true, tier: true }
      });
      if (!assignee || assignee.tier !== currentTier || ROLE_FOR_TIER[currentTier] !== assignee.role) {
        throw new ApiError(400, 'The assignee must belong to the ticket current authority tier');
      }
    }

    const updated = await transaction.ticket.update({
      where: { id: ticket.id },
      data: {
        status: input.toStatus,
        currentTier,
        version: { increment: 1 },
        slaDueAt,
        ...(input.toStatus === 'ESCALATED' ? { assignedToId: null } : {}),
        ...(input.assignedToId ? { assignedToId: input.assignedToId } : {})
      },
      select: {
        id: true,
        status: true,
        currentTier: true,
        version: true,
        slaDueAt: true,
        updatedAt: true
      }
    });

    const payload: JsonValue = {
      fromStatus,
      toStatus: input.toStatus,
      currentTier,
      reason: input.reason?.trim() || null,
      resolutionNote: input.resolutionNote?.trim() || null
    };
    const auditEntry = await appendAuditEntry(
      transaction,
      ticket,
      input.actor.kind === 'system'
        ? input.actor.id ?? 'SYSTEM'
        : input.actor.role === 'PETITIONER' && ticket.isAnonymous
          ? ticket.petitionerRef ?? input.actor.id
          : input.actor.id,
      input.toStatus,
      payload,
      timestamp
    );

    return {
      ticket: {
        ...updated,
        ...(input.toStatus === 'RESOLVED'
          ? { resolvedAt: timestamp, resolutionNote: input.resolutionNote?.trim() }
          : {})
      },
      auditEntry
    };
  }, { maxWait: 10_000, timeout: 20_000 });

  publishTicketUpdate({
    ticketId: result.ticket.id,
    status: result.ticket.status,
    currentTier: result.ticket.currentTier,
    version: result.ticket.version,
    auditSeq: result.auditEntry.seq,
    timestamp: result.auditEntry.timestamp.toISOString(),
    eventType: result.auditEntry.type
  });

  return result;
}

function commentActor(
  ticket: LockedTicket,
  actor: UserActor | null,
  receiptSecret: string | undefined,
  isInternal: boolean
): TicketActor {
  if (actor?.role === 'ADMIN') return actor;

  if (actor && actor.role !== 'PETITIONER' && isTicketAuthority(ticket, actor)) {
    return actor;
  }

  if (
    actor?.role === 'PETITIONER' &&
    !ticket.isAnonymous &&
    ticket.petitionerId === actor.id &&
    !isInternal
  ) {
    return actor;
  }

  if (
    !isInternal &&
    ticket.isAnonymous &&
    receiptSecret &&
    verifyReceiptSecret(receiptSecret, ticket.receiptHash)
  ) {
    return { kind: 'receipt', ticketId: ticket.id };
  }

  if (isInternal) throw new ApiError(403, 'Only authorized staff can add internal comments');
  throw new ApiError(403, 'You cannot comment on this ticket');
}

export async function addTicketComment(input: CommentInput) {
  const content = input.content.trim();
  if (!content || content.length > 2000) {
    throw new ApiError(400, 'Comment must contain between 1 and 2000 characters');
  }

  const result = await prisma.$transaction(async (transaction) => {
    const ticket = await lockTicket(transaction, input.ticketId);
    const actor = commentActor(ticket, input.actor, input.receiptSecret, input.isInternal);
    const timestamp = new Date();
    const auditEntry = await appendAuditEntry(
      transaction,
      ticket,
      actorReference(ticket, actor),
      'COMMENTED',
      { content, isInternal: input.isInternal },
      timestamp
    );

    return { ticketId: ticket.id, seq: auditEntry.seq, hash: auditEntry.hash, timestamp };
  }, { maxWait: 10_000, timeout: 20_000 });

  publishTicketComment(
    {
      ticketId: result.ticketId,
      auditSeq: result.seq,
      timestamp: result.timestamp.toISOString(),
      eventType: 'COMMENTED',
      content: input.content.trim(),
      isInternal: input.isInternal
    },
    input.isInternal
  );

  return result;
}

export async function disputeTicket(input: DisputeInput) {
  const disputeReason = input.disputeReason.trim();
  if (disputeReason.length < 15 || disputeReason.length > 2000) {
    throw new ApiError(400, 'Dispute reason must contain between 15 and 2000 characters');
  }

  const result = await prisma.$transaction(async (transaction) => {
    const ticket = await lockTicket(transaction, input.ticketId);

    const isAuthorized = ticket.isAnonymous
      ? Boolean(input.receiptSecret && verifyReceiptSecret(input.receiptSecret, ticket.receiptHash))
      : Boolean(input.actor?.role === 'PETITIONER' && input.actor.id === ticket.petitionerId);
    if (!isAuthorized) throw new ApiError(403, 'You cannot dispute this ticket');
    if (ticket.status !== 'RESOLVED') {
      throw new ApiError(409, 'Only a resolved ticket can be disputed');
    }

    const resolution = await transaction.auditEntry.findFirst({
      where: { ticketId: ticket.id, type: 'RESOLVED' },
      orderBy: { seq: 'desc' },
      select: { timestamp: true }
    });
    if (!resolution) throw new ApiError(409, 'The resolution timestamp is missing from the audit chain');

    const timestamp = new Date();
    const elapsed = timestamp.getTime() - resolution.timestamp.getTime();
    if (elapsed < 0 || elapsed > DISPUTE_WINDOW_MS) {
      throw new ApiError(409, 'The 72-hour dispute window has closed');
    }
    if (ticket.currentTier >= 3) {
      throw new ApiError(409, 'This ticket is already at the highest authority tier');
    }

    const currentTier = ticket.currentTier + 1;
    const slaDueAt = await getSlaDueAt(
      transaction,
      ticket.priority as Priority,
      currentTier,
      timestamp
    );
    const updated = await transaction.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'ESCALATED',
        currentTier,
        version: { increment: 1 },
        slaDueAt,
        assignedToId: null
      },
      select: {
        id: true,
        status: true,
        currentTier: true,
        version: true,
        slaDueAt: true,
        updatedAt: true
      }
    });

    const actorRef = ticket.isAnonymous ? ticket.petitionerRef : input.actor?.id;
    if (!actorRef) throw new ApiError(500, 'The petitioner reference is missing');

    const auditEntry = await appendAuditEntry(
      transaction,
      ticket,
      actorRef,
      'DISPUTED',
      {
        fromStatus: 'RESOLVED',
        toStatus: 'ESCALATED',
        disputeReason,
        currentTier,
        disputeWindowEndsAt: new Date(resolution.timestamp.getTime() + DISPUTE_WINDOW_MS).toISOString()
      },
      timestamp
    );

    return { ticket: updated, auditEntry };
  }, { maxWait: 10_000, timeout: 20_000 });

  publishTicketUpdate({
    ticketId: result.ticket.id,
    status: result.ticket.status,
    currentTier: result.ticket.currentTier,
    version: result.ticket.version,
    auditSeq: result.auditEntry.seq,
    timestamp: result.auditEntry.timestamp.toISOString(),
    eventType: 'DISPUTED'
  });

  return result;
}
