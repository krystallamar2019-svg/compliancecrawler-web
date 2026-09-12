import { Worker } from 'bullmq';
import { logger } from '../lib/logger.js';
import { getRedisConnection, type ScanQueuePayload } from '../queue/scanQueue.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { processScan } from './processor.js';

const worker = new Worker<ScanQueuePayload>('brandedalign-scans', processScan, {
  connection: getRedisConnection(),
  concurrency: 2,
  lockDuration: 120_000,
});

worker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, scanId: job.data.scanId, result }, 'Scan completed');
});

worker.on('failed', async (job, error) => {
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

worker.on('error', () => {
  logger.error('BullMQ worker error');
});

logger.info({ concurrency: 2 }, 'BrandedAlign scan worker started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'Stopping BrandedAlign scan worker');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
