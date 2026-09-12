import { Router } from 'express';
import { z } from 'zod';
import type Stripe from 'stripe';
import { BillingConfigurationError, getStripe, resolveTestPrice, stripeUrls, type PaidPlanKey } from '../billing/stripe.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const billingRouter = Router();

const checkoutSchema = z.object({
  planKey: z.enum(['steward', 'harvest', 'abundance']),
});

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

    const returnUrl = (await Promise.resolve(stripeUrls())).success;
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
