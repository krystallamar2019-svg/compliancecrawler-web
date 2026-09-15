import type { RequestHandler } from 'express';
import type Stripe from 'stripe';
import { config } from '../config.js';
import { BillingConfigurationError, getStripe } from '../billing/stripe.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { enqueueCapHubEvent } from '../queue/caphubQueue.js';

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const items = subscription.items.data as Array<Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  }>;

  const starts = items.map((item) => item.current_period_start).filter((value): value is number => typeof value === 'number');
  const ends = items.map((item) => item.current_period_end).filter((value): value is number => typeof value === 'number');

  return {
    start: starts.length ? new Date(Math.min(...starts) * 1000).toISOString() : null,
    end: ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null,
  };
}

async function organizationForSubscription(subscription: Stripe.Subscription): Promise<string> {
  const fromMetadata = subscription.metadata?.supabase_org_id;
  if (fromMetadata) return fromMetadata;

  const customerId = customerIdOf(subscription.customer);
  if (!customerId) throw new Error('ORG_RESOLUTION_FAILED');

  const { data, error } = await supabaseAdmin.rpc('find_org_by_stripe_customer', {
    p_customer_id: customerId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.org_id) throw new Error('ORG_RESOLUTION_FAILED');
  return row.org_id;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  if (subscription.livemode) throw new Error('LIVE_EVENT_REJECTED_IN_TEST_BACKEND');

  const organizationId = await organizationForSubscription(subscription);
  const customerId = customerIdOf(subscription.customer);
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const period = subscriptionPeriod(subscription);

  const { data: planKey, error: entitlementError } = await supabaseAdmin.rpc('apply_stripe_subscription_v2', {
    p_org_id: organizationId,
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_price_id: priceId,
    p_status: subscription.status,
    p_current_period_start: period.start,
    p_current_period_end: period.end,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_livemode: false,
  });
  if (entitlementError) throw entitlementError;

  const resolvedPlanKey = typeof planKey === 'string' ? planKey : 'free';
  const { error: mirrorError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      organization_id: organizationId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_key: resolvedPlanKey,
      status: subscription.status,
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      livemode: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' });
  if (mirrorError) throw mirrorError;

  void enqueueCapHubEvent({
    eventType: 'subscription.updated',
    supabase_org_id: organizationId,
    planName: resolvedPlanKey,
    subscriptionStatus: subscription.status,
    renewalDate: period.end,
  }).catch(() => {
    logger.warn({ organizationId }, 'CapHub subscription sync could not be queued');
  });
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (!parent || parent.type !== 'subscription_details') return null;
  const value = parent.subscription_details?.subscription;
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

async function processEvent(event: Stripe.Event) {
  const stripe = getStripe();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription' || !session.subscription) return;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription);
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object as Stripe.Subscription);
      return;
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subscriptionId = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
      if (!subscriptionId) return;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription);
      return;
    }
    case 'payment_intent.payment_failed':
      return;
    default:
      return;
  }
}

function safeFailureCode(error: unknown): string {
  if (error instanceof BillingConfigurationError) return error.message;
  if (error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message)) return error.message;
  return 'STRIPE_EVENT_PROCESSING_FAILED';
}

export const stripeWebhookHandler: RequestHandler = async (req, res) => {
  const signature = req.header('stripe-signature');
  if (!signature || !config.STRIPE_WEBHOOK_SECRET || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'INVALID_WEBHOOK_REQUEST' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(400).json({ error: 'INVALID_WEBHOOK_SIGNATURE' });
    return;
  }

  if (event.livemode) {
    res.status(400).json({ error: 'LIVE_EVENT_REJECTED_IN_TEST_BACKEND' });
    return;
  }

  const { data: shouldProcess, error: beginError } = await supabaseAdmin.rpc('begin_stripe_event', {
    p_event_id: event.id,
    p_event_type: event.type,
  });

  if (beginError) {
    logger.error({ eventId: event.id, eventType: event.type }, 'Stripe event deduplication failed');
    res.status(503).json({ error: 'WEBHOOK_STORAGE_UNAVAILABLE' });
    return;
  }

  if (!shouldProcess) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    await processEvent(event);
    await supabaseAdmin.rpc('finish_stripe_event', {
      p_event_id: event.id,
      p_outcome: 'completed',
      p_error_message: null,
    });
    res.status(200).json({ received: true });
  } catch (error) {
    const code = safeFailureCode(error);
    logger.error({ eventId: event.id, eventType: event.type, code }, 'Stripe event processing failed');
    await supabaseAdmin.rpc('finish_stripe_event', {
      p_event_id: event.id,
      p_outcome: 'failed',
      p_error_message: code,
    });
    res.status(500).json({ error: code });
  }
};
