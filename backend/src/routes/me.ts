import { Router } from 'express';
import type Stripe from 'stripe';
import { getStripe, resolveTestPrice, type PaidPlanKey } from '../billing/stripe.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const meRouter = Router();

const nextPaidPlan: Record<PaidPlanKey, PaidPlanKey | null> = {
  steward: 'harvest',
  harvest: 'abundance',
  abundance: null,
};

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

meRouter.get('/', async (req, res, next) => {
  try {
    const { userId, organizationId, organizationRole } = (req as AuthenticatedRequest).auth;

    const [{ data: organization, error: orgError }, { data: subscription, error: subscriptionError }] = await Promise.all([
      supabaseAdmin
        .from('organizations')
        .select('id,name,plan_tier,plan_key,subscription_status,current_period_start,current_period_end,cancel_at_period_end,billing_blocked,max_sites,max_pages,max_depth,max_concurrent_jobs,plan_scans_limit')
        .eq('id', organizationId)
        .single(),
      supabaseAdmin
        .from('subscriptions')
        .select('plan_key,status,current_period_start,current_period_end,cancel_at_period_end,updated_at')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (orgError) throw orgError;
    if (subscriptionError && subscriptionError.code !== '42P01') throw subscriptionError;

    res.json({
      user: { id: userId },
      organization: {
        id: organization.id,
        name: organization.name,
        role: organizationRole,
      },
      plan: subscription?.plan_key ?? organization.plan_key ?? organization.plan_tier,
      subscriptionStatus: subscription?.status ?? organization.subscription_status,
      currentPeriodStart: subscription?.current_period_start ?? organization.current_period_start,
      currentPeriodEnd: subscription?.current_period_end ?? organization.current_period_end,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? organization.cancel_at_period_end,
      billingBlocked: organization.billing_blocked,
      limits: {
        scans: organization.plan_scans_limit,
        sites: organization.max_sites,
        pages: organization.max_pages,
        depth: organization.max_depth,
        concurrentJobs: organization.max_concurrent_jobs,
      },
    });
  } catch (error) {
    next(error);
  }
});

meRouter.post('/upgrade', async (req, res, next) => {
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
    next(error);
  }
});

meRouter.post('/cancel', async (req, res, next) => {
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

    res.json({ status: 'scheduled', cancelAtPeriodEnd: updated.cancel_at_period_end });
  } catch (error) {
    next(error);
  }
});
