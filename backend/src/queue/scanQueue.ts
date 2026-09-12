import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';

export interface ScanQueuePayload {
  scanId: string;
  organizationId: string;
}

let redis: IORedis | undefined;
let queue: Queue<ScanQueuePayload> | undefined;

export function getRedisConnection() {
  if (!config.REDIS_URL) throw new Error('REDIS_CONFIGURATION_REQUIRED');
  redis ??= new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  return redis;
}

export function getScanQueue() {
  queue ??= new Queue<ScanQueuePayload>('brandedalign-scans', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 500 },
      removeOnFail: { age: 604_800, count: 2_000 },
    },
  });
  return queue;
}

export async function enqueueScan(payload: ScanQueuePayload) {
  return getScanQueue().add('scan', payload, { jobId: payload.scanId });
}
