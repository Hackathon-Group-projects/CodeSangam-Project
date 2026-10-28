import { Queue } from 'bullmq';
import { prisma } from '../db';
import { generateEmbedding, analyzeDistressSentiment } from './inference';
import { computeAuditHash, DEFAULT_SLA_POLICY, Priority } from '@vishanti/shared';

/**
 * Executes Auto-Triage on a newly filed ticket:
 * 1. Computes all-MiniLM-L6-v2 384-d semantic embedding
 * 2. Computes DistilBERT distress sentiment score
 * 3. Saves embedding to pgvector
 * 4. Resolves SLA policy & calculates slaDueAt
 * 5. Assigns an Officer Tier 1
 * 6. Transitions status FILED -> ASSIGNED with cryptographic audit chain H_n
 * 7. Schedules BullMQ delayed SLA breach check job
 */
export async function triageTicket(ticketId: string, taskQueue?: Queue): Promise<void> {
  console.log(`[Auto-Triage] Starting AI triage for ticket: ${ticketId}`);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      auditEntries: {
        orderBy: { seq: 'desc' },
        take: 1
      }
    }
  });

  if (!ticket) {
    console.warn(`[Auto-Triage] Ticket ${ticketId} not found.`);
    return;
  }

  if (ticket.status !== 'FILED') {
    console.log(`[Auto-Triage] Ticket ${ticketId} is already in ${ticket.status} status. Skipping.`);
    return;
  }

  const latestAudit = ticket.auditEntries[0];
  if (!latestAudit) {
    throw new Error(`[Auto-Triage] Ticket ${ticketId} lacks genesis audit entry (seq 0).`);
  }

  const textContent = `${ticket.title}\n\n${ticket.description}`;

  // 1. Local AI Inference
  const [embedding, sentiment] = await Promise.all([
    generateEmbedding(textContent),
    analyzeDistressSentiment(textContent)
  ]);

  // 2. Resolve SLA Policy
  let slaMinutes = 24 * 60; // Default 24 hours
  try {
    const policy = await prisma.slaPolicy.findFirst({
      where: {
        priority: ticket.priority,
        tier: 1
      }
    });
    if (policy) {
      slaMinutes = policy.responseMins;
    } else {
      const defaultPolicy = DEFAULT_SLA_POLICY[ticket.priority as Priority];
      if (defaultPolicy) {
        slaMinutes = defaultPolicy.responseHours * 60;
      }
    }
  } catch (err) {
    console.warn('[Auto-Triage] Error querying SLA policy, using defaults:', err);
  }

  // Adjust SLA for acute distress complaints
  if (sentiment.distressScore > 0.85 && slaMinutes > 120) {
    slaMinutes = Math.floor(slaMinutes / 2);
    console.log(`[Auto-Triage] High distress score (${sentiment.distressScore}) accelerated SLA to ${slaMinutes} mins.`);
  }

  const now = new Date();
  const slaDueAt = new Date(now.getTime() + slaMinutes * 60 * 1000);

  // 3. Resolve or assign Tier 1 Officer
  let officer = await prisma.user.findFirst({
    where: {
      role: 'OFFICER_TIER_1',
      tier: 1
    }
  });

  if (!officer) {
    // Ensure at least one tier 1 officer exists in the system
    officer = await prisma.user.create({
      data: {
        email: 'officer.tier1@vishanti.gov.in',
        name: 'Nodal Redressal Officer (Tier 1)',
        role: 'OFFICER_TIER_1',
        tier: 1
      }
    });
  }

  const newVersion = ticket.version + 1;
  const newSeq = latestAudit.seq + 1;

  const auditPayload = {
    previousStatus: 'FILED',
    newStatus: 'ASSIGNED',
    assignedToId: officer.id,
    assignedOfficer: officer.name || officer.email,
    distressSentimentScore: sentiment.distressScore,
    sentimentLabel: sentiment.label,
    slaDueAt: slaDueAt.toISOString(),
    slaMinutes
  };

  const hash = computeAuditHash({
    prevHash: latestAudit.hash,
    seq: newSeq,
    ticketId: ticket.id,
    actorRef: 'system:ai-triage-daemon',
    type: 'ASSIGNED',
    payload: auditPayload,
    timestamp: now
  });

  // 4. Atomic Transaction: Update ticket state + Append immutable audit entry
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'ASSIGNED',
        assignedToId: officer!.id,
        slaDueAt,
        version: newVersion,
        updatedAt: now
      }
    });

    await tx.auditEntry.create({
      data: {
        ticketId: ticket.id,
        seq: newSeq,
        type: 'ASSIGNED',
        actorRef: 'system:ai-triage-daemon',
        payload: auditPayload,
        prevHash: latestAudit.hash,
        hash,
        timestamp: now
      }
    });
  });

  // 5. Store pgvector embedding
  try {
    const vectorString = `[${embedding.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE tickets SET embedding = $1::vector WHERE id = $2`,
      vectorString,
      ticket.id
    );
  } catch (err) {
    console.warn('[Auto-Triage] pgvector raw update note (ensure pgvector extension is enabled):', err);
  }

  // 6. Schedule BullMQ delayed SLA breach escalation job
  if (taskQueue) {
    const delayMs = Math.max(1000, slaDueAt.getTime() - Date.now());
    await taskQueue.add(
      'check-sla-escalation',
      {
        ticketId: ticket.id,
        expectedVersion: newVersion,
        tier: 1
      },
      {
        jobId: `sla-${ticket.id}-tier1-v${newVersion}`,
        delay: delayMs,
        removeOnComplete: true
      }
    );
    console.log(`[Auto-Triage] Scheduled BullMQ SLA timer for ticket ${ticket.id} (delay: ${delayMs}ms)`);
  }

  console.log(`[Auto-Triage] Ticket ${ticket.id} successfully triaged and ASSIGNED to ${officer.name}.`);
}
