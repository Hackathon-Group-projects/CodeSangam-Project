import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import type { Role } from '@vishanti/shared';
import { prisma } from '../db';
import { config } from '../config';
import { readBearerToken } from '../auth/service';
import { canViewTicket, verifyReceiptSecret, type TicketActor, type UserActor } from './ticket-access';

interface TicketSocketEvent {
  ticketId: string;
  status?: string;
  currentTier?: number;
  version?: number;
  auditSeq?: number;
  timestamp?: string;
  eventType?: string;
  type?: string;
  content?: string;
  isInternal?: boolean;
}

let socketServer: Server | null = null;
let publisher: Redis | null = null;
let subscriber: Redis | null = null;

function ticketRoom(ticketId: string): string {
  return 'ticket:' + ticketId;
}

function staffRoom(ticketId: string): string {
  return 'ticket:' + ticketId + ':staff';
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function startNotificationHub(httpServer: HttpServer): Promise<void> {
  if (socketServer) return;

  const pub = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
  const sub = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });

  try {
    await Promise.all([pub.connect(), sub.connect()]);

    const io = new Server(httpServer, {
      cors: {
        origin: config.webOrigin,
        methods: ['GET', 'POST']
      }
    });
    io.adapter(createAdapter(pub, sub));

    io.use(async (socket, next) => {
      try {
        const auth = socket.handshake.auth as Record<string, unknown> | undefined;
        const authToken = typeof auth?.token === 'string' ? auth.token : undefined;
        const headerToken =
          typeof socket.handshake.headers.authorization === 'string'
            ? socket.handshake.headers.authorization
            : undefined;
        const token = authToken ?? headerToken;

        if (token) {
          const claims = await readBearerToken(token.startsWith('Bearer ') ? token : 'Bearer ' + token);
          if (!claims) throw new Error('Authentication required');

          const user = await prisma.user.findUnique({
            where: { id: claims.id },
            select: { id: true, role: true, tier: true }
          });
          if (!user) throw new Error('Account no longer exists');

          socket.data.actor = {
            kind: 'user',
            id: user.id,
            role: user.role as Role,
            tier: user.tier
          } satisfies UserActor;
          return next();
        }

        const receiptTicketId = auth?.ticketId;
        const receiptSecret = auth?.receiptSecret;
        if (isUuid(receiptTicketId) && typeof receiptSecret === 'string') {
          const ticket = await prisma.ticket.findUnique({
            where: { id: receiptTicketId },
            select: { id: true, isAnonymous: true, receiptHash: true }
          });

          if (ticket?.isAnonymous && verifyReceiptSecret(receiptSecret, ticket.receiptHash)) {
            socket.data.actor = { kind: 'receipt', ticketId: ticket.id } satisfies TicketActor;
            return next();
          }
        }

        return next(new Error('Authentication required'));
      } catch {
        return next(new Error('Authentication required'));
      }
    });

    io.on('connection', (socket) => {
      const joinTicket = async (
        payload: { ticketId?: unknown },
        acknowledge?: (result: { success: boolean; message?: string }) => void
      ) => {
        try {
          if (!isUuid(payload?.ticketId)) {
            acknowledge?.({ success: false, message: 'Ticket ID is invalid' });
            return;
          }

          const ticket = await prisma.ticket.findUnique({
            where: { id: payload.ticketId },
            select: {
              id: true,
              petitionerId: true,
              isAnonymous: true,
              receiptHash: true,
              petitionerRef: true,
              currentTier: true,
              assignedToId: true
            }
          });

          if (!ticket) {
            acknowledge?.({ success: false, message: 'Ticket was not found' });
            return;
          }

          const actor = socket.data.actor as TicketActor | undefined;
          const canJoin =
            actor?.kind === 'receipt'
              ? actor.ticketId === ticket.id
              : actor?.kind === 'user' && canViewTicket(ticket, actor);

          if (!canJoin) {
            acknowledge?.({ success: false, message: 'You cannot access this ticket room' });
            return;
          }

          await socket.join(ticketRoom(ticket.id));
          if (actor?.kind === 'user' && actor.role !== 'PETITIONER') {
            await socket.join(staffRoom(ticket.id));
          }
          acknowledge?.({ success: true });
        } catch {
          acknowledge?.({ success: false, message: 'Could not join the ticket room' });
        }
      };

      socket.on('ticket:join', joinTicket);
      // Keep the existing officer dashboard event working while it adopts ticket:join.
      socket.on('ticket:subscribe', joinTicket);

      socket.on('ticket:leave', async (payload: { ticketId?: unknown }) => {
        if (!isUuid(payload?.ticketId)) return;
        await socket.leave(ticketRoom(payload.ticketId));
        await socket.leave(staffRoom(payload.ticketId));
      });
    });

    publisher = pub;
    subscriber = sub;
    socketServer = io;
  } catch (error) {
    pub.disconnect();
    sub.disconnect();
    throw error;
  }
}

export function publishTicketUpdate(event: TicketSocketEvent): void {
  const room = socketServer?.to(ticketRoom(event.ticketId));
  room?.emit('ticket:updated', event);
  room?.emit('ticket-updated', { ...event, type: event.eventType });
}

export function publishTicketComment(event: TicketSocketEvent, isInternal: boolean): void {
  const room = isInternal ? staffRoom(event.ticketId) : ticketRoom(event.ticketId);
  socketServer?.to(room).emit('ticket:commented', event);
}

export async function stopNotificationHub(): Promise<void> {
  const server = socketServer;
  socketServer = null;

  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  publisher?.disconnect();
  subscriber?.disconnect();
  publisher = null;
  subscriber = null;
}
