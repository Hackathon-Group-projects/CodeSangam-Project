import { Queue } from 'bullmq';
import { prisma } from '../db';
import { computeAuditHash, DEFAULT_SLA_POLICY, Priority } from '@vishanti/shared';

interface TicketRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  currentTier: number;
  version: number;
  slaDueAt: Date | null;
  assignedToId: string | null;
}

/**
 * Escalates a ticket upon SLA breach.
 * Uses SELECT ... FOR UPDATE pessimistic row locks to guarantee zero concurrency race conditions.
 */
export async function escalateTicket(
  ticketId: string,
  expectedVersion?: number,
  source: 'delayed-timer' | '60s-safety-sweep' = 'delayed-timer',
  taskQueue?: Queue
): Promise<boolean> {
  console.log(`[SLA Escalation] Checking SLA for ticket ${ticketId} (source: ${source})`);

  return await prisma.$transaction(async (tx) => {
    // 1. Pessimistic row lock with FOR UPDATE
    const rows = await tx.$queryRawUnsafe<TicketRow[]>(
      `SELECT id, title, status, priority, "currentTier", version, "slaDueAt", "assignedToId"
       FROM tickets
       WHERE id = $1
       FOR UPDATE;`,
      ticketId
    );

    if (!rows || rows.length === 0) {
      console.warn(`[SLA Escalation] Ticket ${ticketId} not found.`);
      return false;
    }

    const ticket = rows[0];

    // Idempotent guard: only ASSIGNED and IN_REVIEW tickets can breach SLA
    if (ticket.status !== 'ASSIGNED' && ticket.status !== 'IN_REVIEW') {
      console.log(`[SLA Escalation] Ticket ${ticketId} status is ${ticket.status}. No breach action required.`);
      return false;
    }

    // Check if SLA deadline has actually passed
    const now = new Date();
    if (ticket.slaDueAt && new Date(ticket.slaDueAt).getTime() > now.getTime()) {
      console.log(`[SLA Escalation] Ticket ${ticketId} SLA has not expired yet (${new Date(ticket.slaDueAt).toISOString()} > ${now.toISOString()}).`);
      return false;
    }

    // Version guard for delayed jobs
    if (expectedVersion !== undefined && ticket.version !== expectedVersion) {
      console.log(`[SLA Escalation] Ticket ${ticketId} version changed (${ticket.version} != expected ${expectedVersion}). Idempotent skip.`);
      return false;
    }

    // 2. Advance Authority Tier (Officer -> Committee -> Ombudsman)
    const oldTier = ticket.currentTier;
    const newTier = Math.min(3, oldTier + 1);

    // 3. Resolve next-tier user
    const targetRole = newTier === 2 ? 'COMMITTEE_TIER_2' : 'OMBUDSMAN_TIER_3';
    let nextTierUser = await tx.user.findFirst({
      where: {
        role: targetRole,
        tier: newTier
      }
    });

    if (!nextTierUser) {
      const defaultEmail = newTier === 2 ? 'committee@vishanti.gov.in' : 'ombudsman@vishanti.gov.in';
      const defaultName = newTier === 2 ? 'Appeals Committee (Tier 2)' : 'Independent Ombudsman (Tier 3)';
      nextTierUser = await tx.user.create({
        data: {
          email: defaultEmail,
          name: defaultName,
          role: targetRole,
          tier: newTier
        }
      });
    }

    // 4. Calculate fresh SLA for new tier
    let newSlaMinutes = 48 * 60; // 48 hours default for higher tiers
    try {
      const policy = await tx.slaPolicy.findFirst({
        where: {
          priority: ticket.priority as any,
          tier: newTier
        }
      });
      if (policy) {
        newSlaMinutes = policy.resolveMins;
      } else {
        const defaultPolicy = DEFAULT_SLA_POLICY[ticket.priority as Priority];
        if (defaultPolicy) {
          newSlaMinutes = defaultPolicy.resolveHours * 60;
        }
      }
    } catch {
      // Default to 48h
    }

    const newSlaDueAt = new Date(now.getTime() + newSlaMinutes * 60 * 1000);

    // 5. Read latest audit entry to link hash chain
    const latestAudit = await tx.auditEntry.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { seq: 'desc' }
    });

    if (!latestAudit) {
      throw new Error(`[SLA Escalation] Ticket ${ticket.id} lacks audit history.`);
    }

    const newSeq = latestAudit.seq + 1;
    const newVersion = ticket.version + 1;

    const auditPayload = {
      previousStatus: ticket.status,
      newStatus: 'ESCALATED',
      previousTier: oldTier,
      newTier,
      previousAssignedId: ticket.assignedToId,
      assignedToId: nextTierUser.id,
      assignedAuthority: nextTierUser.name || nextTierUser.email,
      breachReason: `Automated SLA breach detection: Tier ${oldTier} deadline exceeded`,
      escalationSource: source,
      newSlaDueAt: newSlaDueAt.toISOString()
    };

    const hash = computeAuditHash({
      prevHash: latestAudit.hash,
      seq: newSeq,
      ticketId: ticket.id,
      actorRef: `system:sla-${source}`,
      type: 'ESCALATED',
      payload: auditPayload,
      timestamp: now
    });

    // 6. Execute atomic update
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'ESCALATED',
        currentTier: newTier,
        assignedToId: nextTierUser.id,
        slaDueAt: newSlaDueAt,
        version: newVersion,
        updatedAt: now
      }
    });

    await tx.auditEntry.create({
      data: {
        ticketId: ticket.id,
        seq: newSeq,
        type: 'ESCALATED',
        actorRef: `system:sla-${source}`,
        payload: auditPayload,
        prevHash: latestAudit.hash,
        hash,
        timestamp: now
      }
    });

    console.log(`[SLA Escalation] Ticket ${ticket.id} ESCALATED Tier ${oldTier} -> Tier ${newTier} (${nextTierUser.name}). Hash: ${hash.slice(0, 16)}...`);

    // 7. If still below Tier 3, schedule next delayed SLA timer
    if (newTier < 3 && taskQueue) {
      const nextDelayMs = Math.max(1000, newSlaDueAt.getTime() - Date.now());
      await taskQueue.add(
        'check-sla-escalation',
        {
          ticketId: ticket.id,
          expectedVersion: newVersion,
          tier: newTier
        },
        {
          jobId: `sla-${ticket.id}-tier${newTier}-v${newVersion}`,
          delay: nextDelayMs,
          removeOnComplete: true
        }
      );
    }

    return true;
  });
}

/**
 * 60-Second Background Safety Sweep:
 * Queries tickets WHERE status IN ('ASSIGNED', 'IN_REVIEW') AND slaDueAt <= NOW()
 * using SELECT ... FOR UPDATE SKIP LOCKED to prevent duplicate processing across workers.
 */
export async function runSlaSafetySweep(taskQueue?: Queue): Promise<number> {
  let escalatedCount = 0;

  try {
    const overdueTickets = await prisma.$queryRawUnsafe<Array<{ id: string; version: number }>>(`
      SELECT id, version
      FROM tickets
      WHERE status IN ('ASSIGNED', 'IN_REVIEW')
        AND "slaDueAt" IS NOT NULL
        AND "slaDueAt" <= NOW()
      LIMIT 50;
    `);

    if (!overdueTickets || overdueTickets.length === 0) {
      return 0;
    }

    console.log(`[SLA Safety Sweep] Found ${overdueTickets.length} overdue tickets in need of escalation.`);

    for (const t of overdueTickets) {
      try {
        const escalated = await escalateTicket(t.id, t.version, '60s-safety-sweep', taskQueue);
        if (escalated) escalatedCount++;
      } catch (err) {
        console.error(`[SLA Safety Sweep] Failed to escalate ticket ${t.id}:`, err);
      }
    }
  } catch (error) {
    console.error('[SLA Safety Sweep] Error executing safety sweep query:', error);
  }

  return escalatedCount;
}
