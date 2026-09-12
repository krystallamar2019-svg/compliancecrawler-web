// Free-plan Railway deployment entrypoint: run the HTTP API and BullMQ workers
// in one Node process while keeping Redis in a separate private service.
// The modules own their own startup and graceful-shutdown handlers.
import { config } from './config.js';

const rawStripeKey = config.STRIPE_SECRET_KEY ?? '';
const normalizedStripeKey = rawStripeKey.trim().replace(/^['"]|['"]$/g, '').replace(/^STRIPE_SECRET_KEY=/, '');
const stripeKeyClass = normalizedStripeKey.startsWith('sk_test_')
  ? 'test'
  : normalizedStripeKey.startsWith('sk_live_')
    ? 'live'
    : normalizedStripeKey.startsWith('rk_test_')
      ? 'restricted_test'
      : normalizedStripeKey.startsWith('rk_live_')
        ? 'restricted_live'
        : normalizedStripeKey
          ? 'other'
          : 'missing';

console.log(JSON.stringify({ stripeKeyClass, stripeKeyHasOuterWhitespace: rawStripeKey !== rawStripeKey.trim() }));

import './index.js';
import './worker/index.js';
