const fs = require('fs');

function patch(path, replacements) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!s.includes(from)) throw new Error(`Expected pattern not found in ${path}: ${from}`);
    s = s.split(from).join(to);
  }
  fs.writeFileSync(path, s);
}

patch('src/billing/stripe.ts', [
  ["const key = config.STRIPE_SECRET_KEY?.trim();", "const rawKey = config.STRIPE_SECRET_KEY ?? '';\n  const key = rawKey.trim().replace(/^['\"]|['\"]$/g, '').replace(/^STRIPE_SECRET_KEY=/, '');"],
  ["if (!key.startsWith('sk_test_')) {", "if (!key.startsWith('sk_live_')) {"],
  ["STRIPE_TEST_MODE_REQUIRED", "STRIPE_LIVE_MODE_REQUIRED"],
  [".select('stripe_test_price_id,is_active')", ".select('stripe_live_price_id,is_active')"],
  ["if (!data?.stripe_test_price_id) throw new BillingConfigurationError('PLAN_PRICE_NOT_CONFIGURED');", "if (!data?.stripe_live_price_id) throw new BillingConfigurationError('PLAN_PRICE_NOT_CONFIGURED');"],
  ["return data.stripe_test_price_id;", "return data.stripe_live_price_id;"],
]);

for (const path of ['src/routes/billing.ts', 'src/app.ts']) {
  patch(path, [
    ["if (subscription.livemode) {", "if (!subscription.livemode) {"],
    ["LIVE_SUBSCRIPTION_REJECTED_IN_TEST_BACKEND", "TEST_SUBSCRIPTION_REJECTED_IN_LIVE_BACKEND"],
  ]);
}

patch('src/routes/stripeWebhook.ts', [
  ["if (subscription.livemode) throw new Error('LIVE_EVENT_REJECTED_IN_TEST_BACKEND');", "if (!subscription.livemode) throw new Error('TEST_EVENT_REJECTED_IN_LIVE_BACKEND');"],
  ["p_livemode: false,", "p_livemode: true,"],
  ["livemode: false,", "livemode: true,"],
  ["if (event.livemode) {", "if (!event.livemode) {"],
  ["LIVE_EVENT_REJECTED_IN_TEST_BACKEND", "TEST_EVENT_REJECTED_IN_LIVE_BACKEND"],
]);

patch('src/routes/scans.ts', [
  ["const { userId, organizationId } = (req as AuthenticatedRequest).auth;", "const { userId, organizationId, organizationRole } = (req as AuthenticatedRequest).auth;"],
  ["pageLimit = Math.min(Math.max(Number(organization.max_pages) || 1, 1), 500);", "pageLimit = String(organizationRole || '').toLowerCase() === 'owner' ? 500 : Math.min(Math.max(Number(organization.max_pages) || 1, 1), 500);"],
]);

patch('src/routes/sites.ts', [
  ["const { organizationId, userId } = (req as AuthenticatedRequest).auth;", "const { organizationId, userId, organizationRole } = (req as AuthenticatedRequest).auth;"],
]);

patch('src/routes/agreementReviews.ts', [
  ["const { organizationId, userId } = (req as AuthenticatedRequest).auth;\n    if (!(await requireActiveMembership(organizationId))) {", "const { organizationId, userId, organizationRole } = (req as AuthenticatedRequest).auth;\n    if (String(organizationRole || '').toLowerCase() !== 'owner' && !(await requireActiveMembership(organizationId))) {"],
  ["const { organizationId } = (req as AuthenticatedRequest).auth;\n    if (!(await requireActiveMembership(organizationId))) {", "const { organizationId, organizationRole } = (req as AuthenticatedRequest).auth;\n    if (String(organizationRole || '').toLowerCase() !== 'owner' && !(await requireActiveMembership(organizationId))) {"],
]);

console.log('BRANDEDALIGN_STABLE_BACKEND_PATCH_V1');
