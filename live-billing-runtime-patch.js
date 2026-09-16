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
  ["    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_scan_job_with_quota', {", "    if (String(organizationRole || '').toLowerCase() === 'owner') {\n      let ownerScan = null;\n      const { data: existingOwnerScan, error: existingOwnerError } = await supabaseAdmin\n        .from('scan_jobs')\n        .select('id,status')\n        .eq('organization_id', organizationId)\n        .eq('idempotency_key', idempotencyKey)\n        .maybeSingle();\n      if (existingOwnerError) throw existingOwnerError;\n      ownerScan = existingOwnerScan;\n\n      if (!ownerScan) {\n        const { data: createdOwnerScan, error: ownerCreateError } = await supabaseAdmin\n          .from('scan_jobs')\n          .insert({\n            organization_id: organizationId,\n            site_id: siteId,\n            requested_by: userId,\n            review_type: parsed.data.reviewType,\n            status: 'Queued',\n            requested_url: parsed.data.url,\n            normalized_target: destination.url.toString(),\n            page_limit: pageLimit,\n            idempotency_key: idempotencyKey,\n          })\n          .select('id,status')\n          .single();\n        if (ownerCreateError) throw ownerCreateError;\n        ownerScan = createdOwnerScan;\n      }\n\n      if (!ownerScan?.id) throw new Error('SCAN_JOB_CREATION_FAILED');\n      if (config.REDIS_URL) {\n        try {\n          await enqueueScan({ scanId: ownerScan.id, organizationId });\n        } catch (error) {\n          await supabaseAdmin.from('scan_jobs').update({\n            status: 'Failed',\n            failed_at: new Date().toISOString(),\n            safe_error_code: 'QUEUE_UNAVAILABLE',\n          }).eq('id', ownerScan.id).eq('organization_id', organizationId);\n          throw error;\n        }\n      }\n      res.status(202).json({ scanId: ownerScan.id, status: ownerScan.status ?? 'Queued' });\n      return;\n    }\n\n    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_scan_job_with_quota', {"],
]);

patch('src/routes/sites.ts', [
  ["const { organizationId, userId } = (req as AuthenticatedRequest).auth;", "const { organizationId, userId, organizationRole } = (req as AuthenticatedRequest).auth;"],
  ["    const maxSites = Number(organization.max_sites) || 0;\n    if (organization.billing_blocked || !['active', 'trialing'].includes(organization.subscription_status) || maxSites <= 0) {", "    const maxSites = Number(organization.max_sites) || 0;\n    const isOwner = String(organizationRole || '').toLowerCase() === 'owner';\n    if (!isOwner && (organization.billing_blocked || !['active', 'trialing'].includes(organization.subscription_status) || maxSites <= 0)) {"],
  ["    if ((count ?? 0) >= maxSites) {", "    if (!isOwner && (count ?? 0) >= maxSites) {"],
]);

patch('src/routes/agreementReviews.ts', [
  ["const { organizationId, userId } = (req as AuthenticatedRequest).auth;\n    if (!(await requireActiveMembership(organizationId))) {", "const { organizationId, userId, organizationRole } = (req as AuthenticatedRequest).auth;\n    if (String(organizationRole || '').toLowerCase() !== 'owner' && !(await requireActiveMembership(organizationId))) {"],
  ["const { organizationId } = (req as AuthenticatedRequest).auth;\n    if (!(await requireActiveMembership(organizationId))) {", "const { organizationId, organizationRole } = (req as AuthenticatedRequest).auth;\n    if (String(organizationRole || '').toLowerCase() !== 'owner' && !(await requireActiveMembership(organizationId))) {"],
]);

console.log('BrandedAlign live billing and owner-access patch applied');
