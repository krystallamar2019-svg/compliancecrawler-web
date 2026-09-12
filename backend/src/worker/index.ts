import { Worker } from 'bullmq';
import { deliverCapHubEvent } from '../integrations/caphub.js';
import { logger } from '../lib/logger.js';
import { enqueueCapHubEvent, type CapHubEventPayload } from '../queue/caphubQueue.js';
import { enqueueScan, getRedisConnection, type ScanQueuePayload } from '../queue/scanQueue.js';
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
    try {
      await supabaseAdmin
        .from('usage_ledger')
        .update({ status: 'failed', units_consumed: 0, updated_at: now })
        .eq('scan_job_id', job.data.scanId)
        .eq('organization_id', job.data.organizationId);
    } catch {
      logger.error({ scanId: job.data.scanId }, 'Could not reconcile failed scan usage');
    }

    void enqueueCapHubEvent({
      eventId: `scan-${job.data.scanId}-failed`,
      eventType: 'scan.failed',
      supabase_org_id: job.data.organizationId,
      scanId: job.data.scanId,
      scanStatus: 'Failed',
    }).catch(() => undefined);
  }

  // Never log raw crawler errors here; they can contain target-controlled text.
  void error;
});

scanWorker.on('error', () => logger.error('BullMQ scan worker error'));
capHubWorker.on('error', () => logger.error('BullMQ CapHub worker error'));
capHubWorker.on('failed', (job) => {
  logger.warn({ eventId: job?.data.eventId, attemptsMade: job?.attemptsMade }, 'CapHub delivery attempt failed');
});

async function recoverInterruptedScans() {
  const recoverableStatuses = ['Queued', 'Running', 'Processing findings', 'Generating report'];
  const { data: scans, error } = await supabaseAdmin
    .from('scan_jobs')
    .select('id,organization_id,status')
    .in('status', recoverableStatuses)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    logger.error('Could not inspect recoverable scans at worker startup');
    return;
  }

  for (const scan of scans ?? []) {
    if (scan.status !== 'Queued') {
      const { error: resetError } = await supabaseAdmin
        .from('scan_jobs')
        .update({
          status: 'Queued',
          started_at: null,
          failed_at: null,
          safe_error_code: null,
        })
        .eq('id', scan.id)
        .eq('organization_id', scan.organization_id)
        .in('status', recoverableStatuses);

      if (resetError) {
        logger.warn({ scanId: scan.id }, 'Could not reset interrupted scan for recovery');
        continue;
      }
    }

    try {
      await enqueueScan({ scanId: scan.id, organizationId: scan.organization_id });
    } catch {
      logger.warn({ scanId: scan.id }, 'Could not requeue recoverable scan');
    }
  }

  if ((scans ?? []).length > 0) {
    logger.info({ recoveredCount: scans?.length ?? 0 }, 'Recovered queued or interrupted scans');
  }
}

logger.info({ scanConcurrency: 2, capHubConcurrency: 2 }, 'BrandedAlign workers started');
void recoverInterruptedScans();

async function shutdown(signal: string) {
  logger.info({ signal }, 'Stopping BrandedAlign workers');
  await Promise.all([scanWorker.close(), capHubWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
