import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { deliverCapHubEvent } from '../integrations/caphub.js';
import { getRedisConnection } from './scanQueue.js';

export type CapHubEventType =
  | 'subscription.updated'
  | 'scan.started'
  | 'scan.completed'
  | 'scan.failed'
  | 'onboarding.updated';

export interface CapHubEventPayload {
  eventId: string;
  eventType: CapHubEventType;
  occurredAt: string;
  supabase_org_id: string;
  planName?: string;
  subscriptionStatus?: string;
  renewalDate?: string | null;
  usage?: { consumed: number; limit: number };
  scanId?: string;
  scanStatus?: string;
  scoreSummary?: { overall: number; high: number; critical: number };
  reportReadyPath?: string;
  onboardingStatus?: string;
}

let queue: Queue<CapHubEventPayload> | undefined;

function getQueue() {
  queue ??= new Queue<CapHubEventPayload>('brandedalign-caphub', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 6,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 604_800, count: 2_000 },
    },
  });
  return queue;
}

export async function enqueueCapHubEvent(input: Omit<CapHubEventPayload, 'eventId' | 'occurredAt'> & Partial<Pick<CapHubEventPayload, 'eventId' | 'occurredAt'>>) {
  const payload: CapHubEventPayload = {
    ...input,
    eventId: input.eventId ?? randomUUID(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };

  if (!config.REDIS_URL) {
    await deliverCapHubEvent(payload);
    return { id: payload.eventId, mode: 'direct' as const };
  }

  return getQueue().add(input.eventType, payload, { jobId: payload.eventId });
}
