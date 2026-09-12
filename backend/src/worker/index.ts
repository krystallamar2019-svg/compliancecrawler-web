import { Worker } from 'bullmq';
import { deliverCapHubEvent } from '../integrations/caphub.js';
import { logger } from '../lib/logger.js';
import type { CapHubEventPayload } from '../queue/caphubQueue.js';
import { getRedisConnection, type ScanQueuePayload } from '../queue/scanQueue.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { processScan } from './processor.js';

const scanWorker = new Worker<ScanQueuePayload>('brandedalign-scans', processScan, {
  connection: getRedisConnection(),
  concurrency: 2,
  lockDuration: 120_000,
});

const capHubWorker = new Worker<CapHubEventPayload>('brandedalign-caphub', async (job) => {
  await deliverCapHubEvent(job.data);
  return { delivered: true };
}, {
  connection: getRedisConnection(),
  concurrency: 2,
  lockDuration: 30_000,
});

scanWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, scanId: job.data.scanId, result }, 'Scan completed');
});

scanWorker.on('failed', async (job, error) => {
  if (!job) return;
  const maxAttempts = Number(job.opts.attempts ?? 1);
  const exhausted = job.attemptsMade >= maxAttempts;
  logger.warn({
    jobId: job.id,
    scanId: job.data.scanId,
    attemptsMade: job.attemptsMade,
    maxAttempts,
    exhausted,
  }, 'Scan worker attempt failed');

  if (exhausted) {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('usage_ledger')
      .update({ status: 'failed', units_consumed: 0, updated_at: now })
      .eq('scan_job_id', job.data.scanId)
      .eq('organization_id', job.data.organizationId)
      .catch(() => undefined);
  }

  // Never log raw crawler errors here; they can contain target-controlled text.
  void error;
});

scanWorker.on('error', () => logger.error('BullMQ scan worker error'));
capHubWorker.on('error', () => logger.error('BullMQ CapHub worker error'));
capHubWorker.on('failed', (job) => {
  logger.warn({ eventId: job?.data.eventId, attemptsMade: job?.attemptsMade }, 'CapHub delivery attempt failed');
});

logger.info({ scanConcurrency: 2, capHubConcurrency: 2 }, 'BrandedAlign workers started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'Stopping BrandedAlign workers');
  await Promise.all([scanWorker.close(), capHubWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
