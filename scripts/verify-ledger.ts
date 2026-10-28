#!/usr/bin/env node

/**
 * The Vishanti Ledger - Independent Cryptographic Audit Chain Verifier CLI
 * Deliverable 3 (Owner: Member 3)
 *
 * Verifies the mathematical integrity of the append-only ledger for any ticket:
 * Hn = SHA-256( Hn-1 || seq || ticketId || actorRef || type || canonicalJSON(payload) || timestamp )
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { computeAuditHash, GENESIS_HASH } from '@vishanti/shared';

// Load .env
const envPaths = [resolve(process.cwd(), '.env'), resolve(__dirname, '../.env')];
for (const p of envPaths) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {}
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

function parseArgs(): { ticketId?: string; all?: boolean; help?: boolean } {
  const args = process.argv.slice(2);
  let ticketId: string | undefined;
  let all = false;
  let help = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg.startsWith('--ticket=')) {
      ticketId = arg.split('=')[1];
    } else if (arg === '-t' && args.indexOf(arg) + 1 < args.length) {
      ticketId = args[args.indexOf(arg) + 1];
    } else if (arg === '--all') {
      all = true;
    }
  }

  return { ticketId, all, help };
}

async function verifyTicketChain(ticketId: string): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      currentTier: true,
      version: true
    }
  });

  if (!ticket) {
    console.error(`❌ Ticket not found: ${ticketId}`);
    return false;
  }

  const entries = await prisma.auditEntry.findMany({
    where: { ticketId },
    orderBy: { seq: 'asc' }
  });

  console.log('\n================================================================================');
  console.log(`📜 AUDIT CHAIN VERIFICATION REPORT: TICKET ${ticket.id}`);
  console.log(`   Title:   "${ticket.title}"`);
  console.log(`   Status:  ${ticket.status} (Tier ${ticket.currentTier})`);
  console.log(`   Version: ${ticket.version} | Audit Entries: ${entries.length}`);
  console.log('================================================================================\n');

  if (entries.length === 0) {
    console.warn('⚠️  No audit entries found for this ticket.');
    return false;
  }

  let chainValid = true;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const prevEntry = i > 0 ? entries[i - 1] : null;

    // 1. Genesis check
    if (i === 0) {
      if (entry.seq !== 0) {
        console.error(`❌ [SEQ ${entry.seq}] Genesis entry sequence must be 0 (got ${entry.seq})`);
        chainValid = false;
      }
      if (entry.prevHash !== GENESIS_HASH) {
        console.error(`❌ [SEQ ${entry.seq}] Genesis entry prevHash must be 64 zeroes`);
        chainValid = false;
      }
    } else {
      // 2. Link check
      if (entry.seq !== prevEntry!.seq + 1) {
        console.error(`❌ [SEQ ${entry.seq}] Sequence gap detected! Expected ${prevEntry!.seq + 1}, got ${entry.seq}`);
        chainValid = false;
      }
      if (entry.prevHash !== prevEntry!.hash) {
        console.error(`❌ [SEQ ${entry.seq}] Broken hash link! prevHash (${entry.prevHash.slice(0, 16)}...) != previous entry hash (${prevEntry!.hash.slice(0, 16)}...)`);
        chainValid = false;
      }
    }

    // 3. Cryptographic Equation Recomputation
    let expectedHash: string;
    try {
      expectedHash = computeAuditHash({
        prevHash: entry.prevHash,
        seq: entry.seq,
        ticketId: entry.ticketId,
        actorRef: entry.actorRef,
        type: entry.type,
        payload: entry.payload as any,
        timestamp: entry.timestamp
      });
    } catch (calcError) {
      console.error(`❌ [SEQ ${entry.seq}] Failed computing hash:`, calcError);
      chainValid = false;
      continue;
    }

    const hashMatch = expectedHash === entry.hash;
    if (!hashMatch) {
      console.error(`❌ [SEQ ${entry.seq}] HASH MISMATCH!`);
      console.error(`   Stored:   ${entry.hash}`);
      console.error(`   Expected: ${expectedHash}`);
      chainValid = false;
    } else {
      console.log(`  ✓ [SEQ ${entry.seq.toString().padEnd(2)}] ${entry.type.padEnd(14)} | Actor: ${entry.actorRef.slice(0, 24).padEnd(24)} | Hash: ${entry.hash.slice(0, 20)}... [VALID]`);
    }
  }

  console.log('\n--------------------------------------------------------------------------------');
  if (chainValid) {
    console.log(`✅ VERDICT: TICKET AUDIT CHAIN IS 100% CRYPTOGRAPHICALLY VALID & TAMPER-EVIDENT.`);
  } else {
    console.log(`❌ VERDICT: TAMPERING DETECTED! The cryptographic hash chain was compromised.`);
  }
  console.log('--------------------------------------------------------------------------------\n');

  return chainValid;
}

async function main() {
  const { ticketId, all, help } = parseArgs();

  if (help) {
    console.log(`
================================================================================
📜 The Vishanti Ledger - Independent Cryptographic Audit Chain Verifier CLI
   Webster 2026 Hackathon | Team TriNity (ID 77) — Deliverable 3
================================================================================

Usage:
  npm run verify:ledger -- --ticket=<TICKET_UUID>
  npm run verify:ledger -- --all
  npm run verify:ledger -- --help

Options:
  -t, --ticket=<UUID>   Verify a specific ticket's cryptographic hash chain
  --all                 Verify all tickets recorded in the ledger
  -h, --help            Show this help information

Equation Verified:
  Hn = SHA-256( Hn-1 || seq || ticketId || actorRef || type || canonicalJSON(payload) || timestamp )
================================================================================
`);
    process.exit(0);
  }

  try {
    if (ticketId) {
      const ok = await verifyTicketChain(ticketId);
      process.exit(ok ? 0 : 1);
    }

    // If no ticket specified, find the most recently updated tickets and verify
    console.log('🔍 No specific ticket ID provided. Scanning recent tickets in ledger...');
    const tickets = await prisma.ticket.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, status: true }
    });

    if (tickets.length === 0) {
      console.log('ℹ️  No tickets found in database. Seed tickets or file one via the portal.');
      process.exit(0);
    }

    let allOk = true;
    for (const t of tickets) {
      const ok = await verifyTicketChain(t.id);
      if (!ok) allOk = false;
    }

    process.exit(allOk ? 0 : 1);
  } catch (error: any) {
    if (error?.code === 'P1001' || error?.message?.includes("Can't reach database server")) {
      console.error('\n❌ Could not connect to PostgreSQL database at localhost:5432.');
      console.error('   Please ensure your database container is running:');
      console.error('   docker compose up -d\n');
      process.exit(1);
    }
    console.error('Fatal error during ledger verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
