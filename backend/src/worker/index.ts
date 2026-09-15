import { Worker } from 'bullmq';
import { config } from '../config.js';
import { deliverCapHubEvent } from '../integrations/caphub.js';
import { logger } from '../lib/logger.js';
import { enqueueCapHubEvent, type CapHubEventPayload } from '../queue/caphubQueue.js';
import { enqueueScan, getRedisConnection, type ScanQueuePayload } from '../queue/scanQueue.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { processScan, processScanPayload } from './processor.js';

const DB_LEASE_SECONDS = 900;
const DB_LEASE_RENEW_MS = 60_000;
const DB_IDLE_POLL_MS = 1_500;
const MAX_SCAN_ATTEMPTS = 3;
const RECOVERABLE_STATUSES = ['Queued', 'Running', 'Processing findings', 'Generating report'];

let scanWorker: Worker<ScanQueuePayload> | undefined;
let capHubWorker: Worker<CapHubEventPayload> | undefined;
let stopping = false;
let fallbackLoopPromise: Promise<void> | undefined;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

async function reconcileFailedUsage(scanId: string, organizationId: string) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('usage_ledger')
    .update({ status: 'failed', units_consumed: 0, updated_at: now })
    .eq('scan_job_id', scanId)
    .eq('organization_id', organizationId);
  if (error) throw error;
}

async function emitScanFailed(scanId: string, organizationId: string) {
  await enqueueCapHubEvent({
    eventId: `scan-${scanId}-failed`,
    eventType: 'scan.failed',
    supabase_org_id: organizationId,
    scanId,
    scanStatus: 'Failed',
  });
}

function startBullMqWorkers() {
  scanWorker = new Worker<ScanQueuePayload>('brandedalign-scans', processScan, {
    connection: getRedisConnection(),
    concurrency: 2,
    lockDuration: 120_000,
  });

  capHubWorker = new Worker<CapHubEventPayload>('brandedalign-caphub', async (job) => {
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
      try {
        await reconcileFailedUsage(job.data.scanId, job.data.organizationId);
      } catch {
        logger.error({ scanId: job.data.scanId }, 'Could not reconcile failed scan usage');
      }

      void emitScanFailed(job.data.scanId, job.data.organizationId).catch(() => undefined);
    }

    // Never log raw crawler errors here; they can contain target-controlled text.
    void error;
  });

  scanWorker.on('error', () => logger.error('BullMQ scan worker error'));
  capHubWorker.on('error', () => logger.error('BullMQ CapHub worker error'));
  capHubWorker.on('failed', (job) => {
    logger.warn({ eventId: job?.data.eventId, attemptsMade: job?.attemptsMade }, 'CapHub delivery attempt failed');
  });

  logger.info({ queueMode: 'redis', scanConcurrency: 2, capHubConcurrency: 2 }, 'BrandedAlign workers started');
  void recoverInterruptedScans();
}

async function recoverInterruptedScans() {
  const { data: scans, error } = await supabaseAdmin
    .from('scan_jobs')
    .select('id,organization_id,status')
    .in('status', RECOVERABLE_STATUSES)
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
          lease_expires_at: null,
        })
        .eq('id', scan.id)
        .eq('organization_id', scan.organization_id)
        .in('status', RECOVERABLE_STATUSES);

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

interface ClaimedScan {
  id: string;
  organization_id: string;
  worker_attempts: number;
}

async function claimNextSupabaseScan(): Promise<ClaimedScan | null> {
  const { data, error } = await supabaseAdmin.rpc('claim_next_scan_job', {
    p_lease_seconds: DB_LEASE_SECONDS,
  });
  if (error) throw error;

  const scan = Array.isArray(data) ? data[0] : data;
  if (!scan?.id || !scan?.organization_id) return null;
  return {
    id: String(scan.id),
    organization_id: String(scan.organization_id),
    worker_attempts: Number(scan.worker_attempts ?? 1),
  };
}

async function renewSupabaseLease(scan: ClaimedScan) {
  const { error } = await supabaseAdmin.rpc('renew_scan_job_lease', {
    p_scan_job_id: scan.id,
    p_organization_id: scan.organization_id,
    p_lease_seconds: DB_LEASE_SECONDS,
  });
  if (error) {
    logger.warn({ scanId: scan.id }, 'Could not renew Supabase scan lease');
  }
}

async function handleSupabaseAttemptFailure(scan: ClaimedScan) {
  if (scan.worker_attempts < MAX_SCAN_ATTEMPTS) {
    const { error } = await supabaseAdmin
      .from('scan_jobs')
      .update({
        status: 'Queued',
        failed_at: null,
        safe_error_code: null,
        lease_expires_at: null,
      })
      .eq('id', scan.id)
      .eq('organization_id', scan.organization_id)
      .eq('status', 'Failed');

    if (error) {
      logger.error({ scanId: scan.id }, 'Could not requeue failed Supabase scan');
    }
    return;
  }

  try {
    await reconcileFailedUsage(scan.id, scan.organization_id);
  } catch {
    logger.error({ scanId: scan.id }, 'Could not reconcile exhausted Supabase scan usage');
  }
  void emitScanFailed(scan.id, scan.organization_id).catch(() => undefined);
}

async function finalizeExpiredExhaustedScans() {
  const now = new Date().toISOString();
  const { data: scans, error } = await supabaseAdmin
    .from('scan_jobs')
    .select('id,organization_id')
    .in('status', RECOVERABLE_STATUSES)
    .gte('worker_attempts', MAX_SCAN_ATTEMPTS)
    .lt('lease_expires_at', now)
    .limit(100);

  if (error) {
    logger.warn('Could not inspect exhausted Supabase scan leases');
    return;
  }

  for (const scan of scans ?? []) {
    const { error: updateError } = await supabaseAdmin
      .from('scan_jobs')
      .update({
        status: 'Failed',
        failed_at: now,
        safe_error_code: 'WORKER_ATTEMPTS_EXHAUSTED',
        lease_expires_at: null,
      })
      .eq('id', scan.id)
      .eq('organization_id', scan.organization_id)
      .in('status', RECOVERABLE_STATUSES);

    if (updateError) continue;
    await reconcileFailedUsage(scan.id, scan.organization_id).catch(() => undefined);
    void emitScanFailed(scan.id, scan.organization_id).catch(() => undefined);
  }
}

async function runSupabaseWorkerLoop() {
  logger.info({ queueMode: 'supabase', scanConcurrency: 1 }, 'BrandedAlign durable Supabase worker started');

  while (!stopping) {
    try {
      await finalizeExpiredExhaustedScans();
      const scan = await claimNextSupabaseScan();
      if (!scan) {
        await sleep(DB_IDLE_POLL_MS);
        continue;
      }

      const heartbeat = setInterval(() => {
        void renewSupabaseLease(scan);
      }, DB_LEASE_RENEW_MS);
      heartbeat.unref();

      try {
        await processScanPayload({ scanId: scan.id, organizationId: scan.organization_id });
      } catch {
        await handleSupabaseAttemptFailure(scan);
      } finally {
        clearInterval(heartbeat);
      }
    } catch {
      logger.error('Supabase worker loop iteration failed');
      await sleep(3_000);
    }
  }
}

if (config.REDIS_URL) {
  startBullMqWorkers();
} else {
  fallbackLoopPromise = runSupabaseWorkerLoop();
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'Stopping BrandedAlign workers');
  stopping = true;

  const closers: Promise<unknown>[] = [];
  if (scanWorker) closers.push(scanWorker.close());
  if (capHubWorker) closers.push(capHubWorker.close());
  if (fallbackLoopPromise) {
    closers.push(Promise.race([fallbackLoopPromise, sleep(10_000)]));
  }

  await Promise.allSettled(closers);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
