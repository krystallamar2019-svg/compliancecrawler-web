import { Router } from 'express';
import { z } from 'zod';
import type Stripe from 'stripe';
import { BillingConfigurationError, getStripe, resolveTestPrice, stripeUrls, type PaidPlanKey } from '../billing/stripe.js';
import { config } from '../config.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const billingRouter = Router();

const checkoutSchema = z.union([
  z.object({ planKey: z.enum(['steward', 'harvest', 'abundance']) }),
  z.object({ plan_key: z.enum(['steward', 'harvest', 'abundance']) }),
]).transform((value) => ({
  planKey: 'planKey' in value ? value.planKey : value.plan_key,
}));

const nextPaidPlan: Record<PaidPlanKey, PaidPlanKey | null> = {
  steward: 'harvest',
  harvest: 'abundance',
  abundance: null,
};

async function getOrCreateCustomer(organizationId: string, existingCustomerId: string | null): Promise<string> {
  const stripe = getStripe();

  if (existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(existingCustomerId);
      if (!('deleted' in existing) || !existing.deleted) return existing.id;
    } catch {
      // A customer ID from another Stripe mode/account is not reusable here.
    }
  }

  const customer = await stripe.customers.create({
    metadata: { supabase_org_id: organizationId },
  });

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq('id', organizationId);

  if (error) throw error;
  return customer.id;
}

async function currentPaidSubscription(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id,plan_key,status,cancel_at_period_end,updated_at')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function expandedInvoice(subscription: Stripe.Subscription): Stripe.Invoice | null {
  const invoice = subscription.latest_invoice;
  return invoice && typeof invoice !== 'string' ? invoice : null;
}

billingRouter.post('/checkout', async (req, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_PLAN' });
      return;
    }

    const { organizationId } = (req as AuthenticatedRequest).auth;
    const planKey = parsed.data.planKey as PaidPlanKey;
    const stripe = getStripe();
    const priceId = await resolveTestPrice(planKey);
    const urls = stripeUrls();

    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;

    const customerId = await getOrCreateCustomer(organizationId, organization.stripe_customer_id);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: urls.success,
      cancel_url: urls.cancel,
      client_reference_id: organizationId,
      metadata: {
        supabase_org_id: organizationId,
        plan_key: planKey,
      },
      subscription_data: {
        metadata: {
          supabase_org_id: organizationId,
          plan_key: planKey,
        },
      },
    });

    if (!session.url) throw new BillingConfigurationError('CHECKOUT_URL_UNAVAILABLE');
    res.status(201).json({ url: session.url });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      res.status(503).json({ error: error.message });
      return;
    }
    next(error);
  }
});

billingRouter.post('/upgrade-membership', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const record = await currentPaidSubscription(organizationId);
    if (!record?.stripe_subscription_id) {
      res.status(409).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
      return;
    }

    const currentPlan = String(record.plan_key ?? '').toLowerCase() as PaidPlanKey;
    if (!['steward', 'harvest', 'abundance'].includes(currentPlan)) {
      res.status(409).json({ error: 'UPGRADE_PLAN_UNAVAILABLE' });
      return;
    }
    const targetPlan = nextPaidPlan[currentPlan];
    if (!targetPlan) {
      res.status(409).json({ error: 'HIGHEST_PLAN_ACTIVE' });
      return;
    }
    if (record.cancel_at_period_end) {
      res.status(409).json({ error: 'SUBSCRIPTION_CANCELS_AT_PERIOD_END' });
      return;
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(record.stripe_subscription_id);
    if (subscription.livemode) {
      res.status(409).json({ error: 'LIVE_SUBSCRIPTION_REJECTED_IN_TEST_BACKEND' });
      return;
    }
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) {
      res.status(409).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
      return;
    }

    const item = subscription.items.data[0];
    if (!item) {
      res.status(409).json({ error: 'SUBSCRIPTION_ITEM_REQUIRED' });
      return;
    }

    const targetPriceId = await resolveTestPrice(targetPlan);
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: targetPriceId, quantity: 1 }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
      expand: ['latest_invoice'],
    });

    const invoice = expandedInvoice(updated);
    const paymentPending = Boolean(updated.pending_update);

    res.json({
      currentPlan,
      targetPlan,
      status: paymentPending ? 'payment_required' : 'upgraded',
      invoiceStatus: invoice?.status ?? null,
      paymentUrl: paymentPending ? invoice?.hosted_invoice_url ?? null : null,
      renewalDateUnchanged: true,
    });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      res.status(503).json({ error: error.message });
      return;
    }
    next(error);
  }
});

billingRouter.post('/cancel-membership', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const record = await currentPaidSubscription(organizationId);
    if (!record?.stripe_subscription_id) {
      res.status(409).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
      return;
    }
    if (record.cancel_at_period_end) {
      res.json({ status: 'already_scheduled', cancelAtPeriodEnd: true });
      return;
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(record.stripe_subscription_id);
    if (subscription.livemode) {
      res.status(409).json({ error: 'LIVE_SUBSCRIPTION_REJECTED_IN_TEST_BACKEND' });
      return;
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    res.json({
      status: 'scheduled',
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      res.status(503).json({ error: error.message });
      return;
    }
    next(error);
  }
});

billingRouter.post('/billing-portal', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const stripe = getStripe();

    const { data: organization, error } = await supabaseAdmin
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();
    if (error) throw error;
    if (!organization.stripe_customer_id) {
      res.status(409).json({ error: 'STRIPE_CUSTOMER_REQUIRED' });
      return;
    }

    const returnUrl = config.APP_URL ?? stripeUrls().success;
    const portal = await stripe.billingPortal.sessions.create({
      customer: organization.stripe_customer_id,
      return_url: returnUrl,
    });

    res.json({ url: portal.url });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      res.status(503).json({ error: error.message });
      return;
    }
    next(error);
  }
});
