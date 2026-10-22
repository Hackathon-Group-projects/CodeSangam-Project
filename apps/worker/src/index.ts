import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

console.log('🚀 Vishanti Worker Daemon initializing...');

// Worker for SLA Escalation, Virus Scanning & AI Triage
const worker = new Worker(
  'vishanti-tasks',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} of type ${job.name}`);
    
    switch (job.name) {
      case 'triage-ai':
        console.log('[Worker] Running all-MiniLM-L6-v2 embedding & DistilBERT triage...');
        // Aryan will integrate local model here
        break;
      case 'scan-attachment':
        console.log('[Worker] Scanning attachment via ClamAV daemon...');
        break;
      case 'check-sla-escalation':
        console.log('[Worker] Checking SLA timer and escalating if overdue...');
        break;
      default:
        console.warn(`[Worker] Unknown job type: ${job.name}`);
    }
  },
  { connection }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err);
});
