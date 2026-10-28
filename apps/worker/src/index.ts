import './config';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config';
import { prisma } from './db';
import { triageTicket } from './ai/triage';
import { clusterTickets, ensureHnswIndexes } from './ai/clustering';
import { escalateTicket, runSlaSafetySweep } from './sla/escalation';
import { scanAttachment } from './scanner/clamav';
import { generateDailyMerkleCheckpoint } from './merkle/checkpoint';

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

connection.on('error', (err) => {
  console.warn(`[Worker] Redis connection advisory: ${err.message}`);
});

export const taskQueue = new Queue('vishanti-tasks', { connection });

taskQueue.on('error', (err) => {
  console.warn(`[Worker] BullMQ queue advisory: ${err.message}`);
});

console.log('🚀 Vishanti Worker Daemon initializing...');
console.log(`[Worker] Connected to Redis: ${config.redisUrl}`);

// BullMQ Worker for AI Inference, SLA Escalations, Virus Scanning & Clustering
export const worker = new Worker(
  'vishanti-tasks',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} of type "${job.name}"`);

    switch (job.name) {
      case 'triage-ai':
        await triageTicket(job.data.ticketId, taskQueue);
        break;

      case 'scan-attachment':
        await scanAttachment(job.data.attachmentId);
        break;

      case 'check-sla-escalation':
        await escalateTicket(
          job.data.ticketId,
          job.data.expectedVersion,
          'delayed-timer',
          taskQueue
        );
        break;

      case 'cluster-semantic-issues':
        await clusterTickets();
        break;

      case 'merkle-checkpoint':
        await generateDailyMerkleCheckpoint();
        break;

      default:
        console.warn(`[Worker] Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 5
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} (${job.name}) completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} (${job?.name}) failed with error:`, err);
});

worker.on('error', (err) => {
  console.warn(`[Worker] BullMQ worker connection advisory: ${err.message}`);
});

// 60-Second SLA Safety Sweep (SELECT ... FOR UPDATE SKIP LOCKED)
const sweepInterval = setInterval(async () => {
  try {
    await runSlaSafetySweep(taskQueue);
  } catch (error) {
    console.error('[Worker] Error running scheduled SLA safety sweep:', error);
  }
}, 60 * 1000);

// Periodic Semantic Clustering (every 5 minutes)
const clusteringInterval = setInterval(async () => {
  try {
    await clusterTickets();
  } catch (error) {
    console.error('[Worker] Error running periodic semantic clustering:', error);
  }
}, 5 * 60 * 1000);

// Daily Merkle Root Checkpoint (every 24 hours)
const merkleInterval = setInterval(async () => {
  try {
    await generateDailyMerkleCheckpoint();
  } catch (error) {
    console.error('[Worker] Error running daily Merkle checkpoint:', error);
  }
}, 24 * 60 * 60 * 1000);

async function startup() {
  await ensureHnswIndexes();
  console.log('✅ Vishanti Worker Daemon is active and listening for background tasks.');
}

startup().catch((err) => {
  console.warn('[Worker] Startup advisory:', err);
});

async function shutdown() {
  console.log('🛑 Vishanti Worker Daemon shutting down...');
  clearInterval(sweepInterval);
  clearInterval(clusteringInterval);
  clearInterval(merkleInterval);
  await worker.close();
  await taskQueue.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
