import { createHmac } from 'node:crypto';
import type { CapHubEventPayload } from '../queue/caphubQueue.js';
import { config } from '../config.js';

export class CapHubConfigurationError extends Error {
  constructor(message = 'CAPHUB_CONFIGURATION_REQUIRED') {
    super(message);
  }
}

export async function deliverCapHubEvent(payload: CapHubEventPayload) {
  if (!config.CAPHUB_WEBHOOK_URL || !config.CAPHUB_WEBHOOK_SECRET) {
    throw new CapHubConfigurationError();
  }

  const destination = new URL(config.CAPHUB_WEBHOOK_URL);
  if (destination.protocol !== 'https:') {
    throw new CapHubConfigurationError('CAPHUB_HTTPS_REQUIRED');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', config.CAPHUB_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex');

  const response = await fetch(destination, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'content-type': 'application/json',
      'user-agent': 'BrandedAlign-CapHub-Sync/1.0',
      'x-brandedalign-event-id': payload.eventId,
      'x-brandedalign-timestamp': timestamp,
      'x-brandedalign-signature': `sha256=${signature}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`CAPHUB_DELIVERY_HTTP_${response.status}`);
  }

  await response.body?.cancel().catch(() => undefined);
}
