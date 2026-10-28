import { createHash, timingSafeEqual } from 'node:crypto';
import type { Ticket } from '@vishanti/db';
import type { Role } from '@vishanti/shared';

export interface UserActor {
  kind: 'user';
  id: string;
  role: Role;
  tier: number;
}

export interface ReceiptActor {
  kind: 'receipt';
  ticketId: string;
}

export type TicketActor = UserActor | ReceiptActor;

export type TicketAccessDetails = Pick<
  Ticket,
  'id' | 'petitionerId' | 'isAnonymous' | 'receiptHash' | 'petitionerRef' | 'currentTier' | 'assignedToId'
>;

const ROLE_FOR_TIER: Record<number, Role> = {
  1: 'OFFICER_TIER_1',
  2: 'COMMITTEE_TIER_2',
  3: 'OMBUDSMAN_TIER_3'
};

export function isTicketAuthority(ticket: TicketAccessDetails, actor: UserActor): boolean {
  if (actor.role === 'ADMIN') return true;

  return (
    actor.tier === ticket.currentTier &&
    ROLE_FOR_TIER[ticket.currentTier] === actor.role &&
    (!ticket.assignedToId || ticket.assignedToId === actor.id)
  );
}

export function canViewTicket(ticket: TicketAccessDetails, actor: UserActor): boolean {
  if (actor.role === 'PETITIONER') {
    return !ticket.isAnonymous && ticket.petitionerId === actor.id;
  }

  return isTicketAuthority(ticket, actor);
}

export function verifyReceiptSecret(secret: string, storedHash: string | null): boolean {
  if (!storedHash || !/^[0-9a-f]{64}$/.test(secret) || !/^[0-9a-f]{64}$/.test(storedHash)) {
    return false;
  }

  const actual = createHash('sha256').update(secret, 'utf8').digest();
  const expected = Buffer.from(storedHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function actorReference(ticket: TicketAccessDetails, actor: TicketActor): string {
  if (actor.kind === 'receipt') {
    if (actor.ticketId !== ticket.id || !ticket.petitionerRef) {
      throw new Error('Anonymous ticket reference is unavailable');
    }
    return ticket.petitionerRef;
  }

  if (actor.role === 'PETITIONER' && ticket.isAnonymous && ticket.petitionerRef) {
    return ticket.petitionerRef;
  }

  return actor.id;
}
