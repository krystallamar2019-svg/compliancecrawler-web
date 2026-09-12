import Stripe from 'stripe';
import { config } from '../config.js';
import { supabaseAdmin } from '../lib/supabase.js';

export type PaidPlanKey = 'steward' | 'harvest' | 'abundance';

export class BillingConfigurationError extends Error {
  constructor(message = 'BILLING_CONFIGURATION_REQUIRED') {
    super(message);
  }
}

let client: Stripe | undefined;

export function getStripe(): Stripe {
  const key = config.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new BillingConfigurationError();
  if (!key.startsWith('sk_test_')) {
    throw new BillingConfigurationError('STRIPE_TEST_MODE_REQUIRED');
  }
  client ??= new Stripe(key, { maxNetworkRetries: 2 });
  return client;
}

function configuredPrice(planKey: PaidPlanKey): string | undefined {
  switch (planKey) {
    case 'steward':
      return config.STRIPE_STEWARD_PRICE_ID;
    case 'harvest':
      return config.STRIPE_HARVEST_PRICE_ID;
    case 'abundance':
      return config.STRIPE_ABUNDANCE_PRICE_ID;
  }
}

export async function resolveTestPrice(planKey: PaidPlanKey): Promise<string> {
  const envPrice = configuredPrice(planKey);
  if (envPrice) return envPrice;

  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('stripe_test_price_id,is_active')
    .eq('plan_key', planKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data?.stripe_test_price_id) throw new BillingConfigurationError('PLAN_PRICE_NOT_CONFIGURED');
  return data.stripe_test_price_id;
}

export function stripeUrls() {
  const success = config.STRIPE_SUCCESS_URL ?? (config.APP_URL ? `${config.APP_URL.replace(/\/$/, '')}/billing/success` : undefined);
  const cancel = config.STRIPE_CANCEL_URL ?? (config.APP_URL ? `${config.APP_URL.replace(/\/$/, '')}/pricing` : undefined);

  if (!success || !cancel) throw new BillingConfigurationError('BILLING_RETURN_URLS_REQUIRED');
  return { success, cancel };
}
