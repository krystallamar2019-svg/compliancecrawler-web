import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const stagingConfirmed = process.env.BRANDEDALIGN_INTEGRATION_CONFIRM === 'staging-only';
const integrationSkip = stagingConfirmed ? false : 'Set BRANDEDALIGN_INTEGRATION_CONFIRM=staging-only and dedicated staging credentials.';

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing integration environment variable: ${name}`);
  return value;
}

function signedStripeHeaders(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return { 'stripe-signature': `t=${timestamp},v1=${signature}` };
}

function stripeEvent(type: string, object: Record<string, unknown>, eventId: string) {
  return JSON.stringify({
    id: eventId,
    object: 'event',
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  });
}

function serviceClient() {
  return createClient(env('INTEGRATION_SUPABASE_URL'), env('INTEGRATION_SUPABASE_SERVICE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function userClient(jwt: string) {
  return createClient(env('INTEGRATION_SUPABASE_URL'), env('INTEGRATION_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${env('INTEGRATION_API_URL').replace(/\/$/, '')}${path}`, init);
}

test('Stripe webhook rejects invalid signatures', { skip: integrationSkip }, async () => {
  const response = await api('/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 't=1,v1=definitely-wrong',
    },
    body: JSON.stringify({ id: 'evt_invalid', type: 'payment_intent.payment_failed' }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error?: string }).error, 'INVALID_WEBHOOK_SIGNATURE');
});

test('Stripe event processing is idempotent', { skip: integrationSkip }, async () => {
  const eventId = `evt_integration_idempotency_${Date.now()}`;
  const payload = stripeEvent('payment_intent.payment_failed', { id: 'pi_integration', object: 'payment_intent' }, eventId);
  const signature = signedStripeHeaders(payload, env('INTEGRATION_STRIPE_WEBHOOK_SECRET'));

  const first = await api('/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signature },
    body: payload,
  });
  assert.equal(first.status, 200);

  const second = await api('/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signature },
    body: payload,
  });
  assert.equal(second.status, 200);
  const result = await second.json() as { duplicate?: boolean };
  assert.equal(result.duplicate, true);
});

test('subscription webhook changes entitlement only from a signed event', { skip: integrationSkip }, async () => {
  const orgId = env('INTEGRATION_TEST_ORG_ID');
  const priceId = env('INTEGRATION_TEST_STEWARD_PRICE_ID');
  const subscriptionId = `sub_integration_${Date.now()}`;
  const customerId = `cus_integration_${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  const payload = stripeEvent('customer.subscription.updated', {
    id: subscriptionId,
    object: 'subscription',
    customer: customerId,
    status: 'active',
    livemode: false,
    cancel_at_period_end: false,
    metadata: { supabase_org_id: orgId },
    items: {
      data: [{
        id: `si_integration_${Date.now()}`,
        current_period_start: now,
        current_period_end: now + 2_592_000,
        price: { id: priceId, object: 'price' },
      }],
    },
  }, `evt_integration_entitlement_${Date.now()}`);

  const response = await api('/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...signedStripeHeaders(payload, env('INTEGRATION_STRIPE_WEBHOOK_SECRET')),
    },
    body: payload,
  });
  assert.equal(response.status, 200);

  const admin = serviceClient();
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('plan_key,subscription_status,stripe_subscription_id')
    .eq('id', orgId)
    .single();
  assert.ifError(orgError);
  assert.equal(org.plan_key, 'steward');
  assert.equal(org.subscription_status, 'active');
  assert.equal(org.stripe_subscription_id, subscriptionId);

  const { data: mirror, error: mirrorError } = await admin
    .from('subscriptions')
    .select('plan_key,status')
    .eq('stripe_subscription_id', subscriptionId)
    .single();
  assert.ifError(mirrorError);
  assert.equal(mirror.plan_key, 'steward');
  assert.equal(mirror.status, 'active');
});

test('parallel quota reservations cannot exceed one remaining scan', { skip: integrationSkip }, async () => {
  const admin = serviceClient();
  const orgId = env('INTEGRATION_QUOTA_ORG_ID');
  const periodKey = `integration-quota-${Date.now()}`;

  const { data: original, error: originalError } = await admin
    .from('organizations')
    .select('subscription_status,billing_blocked,plan_scans_limit')
    .eq('id', orgId)
    .single();
  assert.ifError(originalError);

  const { error: prepError } = await admin.from('organizations').update({
    subscription_status: 'active',
    billing_blocked: false,
    plan_scans_limit: 1,
  }).eq('id', orgId);
  assert.ifError(prepError);

  try {
    const makeReservation = (suffix: string) => admin.rpc('create_scan_job_with_quota', {
      p_organization_id: orgId,
      p_site_id: null,
      p_requested_by: null,
      p_review_type: 'just_compliance',
      p_requested_url: 'https://example.com/',
      p_normalized_target: 'https://example.com/',
      p_page_limit: 1,
      p_billing_period_key: periodKey,
      p_idempotency_key: `integration-${Date.now()}-${suffix}`,
    });

    const results = await Promise.all([makeReservation('a'), makeReservation('b')]);
    const successes = results.filter((result) => !result.error);
    const failures = results.filter((result) => result.error);
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.match(failures[0]!.error!.message, /scan_quota_exceeded/i);
  } finally {
    await admin.from('usage_ledger').delete().eq('organization_id', orgId).eq('billing_period_key', periodKey);
    await admin.from('scan_jobs').delete().eq('organization_id', orgId).like('idempotency_key', 'integration-%');
    await admin.from('organizations').update({
      subscription_status: original.subscription_status,
      billing_blocked: original.billing_blocked,
      plan_scans_limit: original.plan_scans_limit,
    }).eq('id', orgId);
  }
});

test('domain verification challenge stores a hash, not the raw token', { skip: integrationSkip }, async () => {
  const siteId = env('INTEGRATION_DOMAIN_SITE_ID');
  const jwt = env('INTEGRATION_CUSTOMER_JWT');
  const response = await api(`/api/sites/${siteId}/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'meta_tag' }),
  });
  assert.equal(response.status, 201);
  const challenge = await response.json() as { token: string };
  assert.ok(challenge.token.length >= 20);

  const admin = serviceClient();
  const { data: row, error } = await admin
    .from('domain_verifications')
    .select('id,token_hash,status')
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  assert.ifError(error);
  assert.notEqual(row.token_hash, challenge.token);
  assert.equal(row.token_hash.length, 64);

  const wrongCheck = await api(`/api/sites/${siteId}/verify/check`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({ token: `${challenge.token}x` }),
  });
  assert.equal(wrongCheck.status, 400);
});

test('RLS prevents tenant A from selecting tenant B organization', { skip: integrationSkip }, async () => {
  const tenantAJwt = env('INTEGRATION_TENANT_A_JWT');
  const tenantBJwt = env('INTEGRATION_TENANT_B_JWT');
  const tenantAOrg = env('INTEGRATION_TENANT_A_ORG_ID');
  const tenantBOrg = env('INTEGRATION_TENANT_B_ORG_ID');

  const clientA = userClient(tenantAJwt);
  const clientB = userClient(tenantBJwt);

  const [{ data: aOwn, error: aOwnError }, { data: aOther, error: aOtherError }, { data: bOwn, error: bOwnError }] = await Promise.all([
    clientA.from('organizations').select('id').eq('id', tenantAOrg),
    clientA.from('organizations').select('id').eq('id', tenantBOrg),
    clientB.from('organizations').select('id').eq('id', tenantBOrg),
  ]);

  assert.ifError(aOwnError);
  assert.ifError(aOtherError);
  assert.ifError(bOwnError);
  assert.equal(aOwn?.length, 1);
  assert.equal(aOther?.length, 0);
  assert.equal(bOwn?.length, 1);
});

test('customer cannot access admin route while AAL2 admin can', { skip: integrationSkip }, async () => {
  const customer = await api('/api/admin/me', {
    headers: { authorization: `Bearer ${env('INTEGRATION_CUSTOMER_JWT')}` },
  });
  assert.equal(customer.status, 403);

  const admin = await api('/api/admin/me', {
    headers: { authorization: `Bearer ${env('INTEGRATION_ADMIN_AAL2_JWT')}` },
  });
  assert.equal(admin.status, 200);
});
