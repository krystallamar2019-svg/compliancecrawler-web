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

patch('src/routes/agreementReviews.ts', [
  ["async function requireActiveMembership(organizationId: string) {", `function decodeSearchHref(raw: string): string | null {
  try {
    const value = raw.replace(/&amp;/g, '&');
    const absolute = value.startsWith('//') ? 'https:' + value : value;
    const parsed = new URL(absolute, 'https://duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    const target = redirected ? decodeURIComponent(redirected) : parsed.toString();
    const url = new URL(target);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function agreementCandidateScore(companyName: string, title: string, urlValue: string): number {
  let score = 0;
  const haystack = (title + ' ' + urlValue).toLowerCase();
  const compactCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  try {
    const host = new URL(urlValue).hostname.toLowerCase().replace(/^www\\./, '');
    const compactHost = host.replace(/[^a-z0-9]/g, '');
    if (compactCompany.length >= 4 && compactHost.includes(compactCompany)) score += 80;
    const importantTokens = companyName.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 4);
    if (importantTokens.some((token) => host.includes(token))) score += 45;
    if (/reddit|facebook|instagram|youtube|scribd|pinterest|linkedin/.test(host)) score -= 60;
  } catch {}
  if (/affiliate agreement|associate agreement|distributor agreement|independent.*agreement|policies.{0,5}procedures|policy manual|compliance|terms.{0,5}conditions/.test(haystack)) score += 45;
  if (/agreement|polic|procedure|compliance|terms/.test(haystack)) score += 20;
  if (/\\.pdf(?:$|[?#])/.test(urlValue.toLowerCase())) score += 12;
  const years = haystack.match(/20(?:2[4-9]|3[0-9])/g) || [];
  if (years.length) score += Math.max(...years.map(Number)) - 2020;
  return score;
}

function inferAgreementMetadata(text: string, fallbackTitle: string) {
  const titleLine = text.match(/^Title:\\s*(.+)$/mi)?.[1]?.trim();
  const dateMatch = text.match(/(?:effective|updated|revised|revision date|last updated)\\s*(?:date)?\\s*[:\\-]?\\s*([A-Z][a-z]+\\s+\\d{1,2},\\s+20\\d{2}|20\\d{2}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[/.-]\\d{1,2}[/.-]20\\d{2})/i);
  const versionMatch = text.match(/(?:version|revision|rev\\.?)\\s*[:#-]?\\s*([A-Za-z0-9._-]{1,30})/i);
  return {
    title: (titleLine || fallbackTitle || 'Current company agreement').slice(0, 300),
    effectiveDateText: dateMatch?.[1] || null,
    version: versionMatch?.[1]?.slice(0, 120) || null,
  };
}

async function fetchReadableAgreement(urlValue: string): Promise<string | null> {
  try {
    const readerUrl = 'https://r.jina.ai/' + urlValue;
    const response = await fetch(readerUrl, {
      headers: { 'User-Agent': 'BrandedAlign/1.0 agreement discovery' },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const text = (await response.text()).trim();
    if (text.length < 700) return null;
    const agreementSignals = (text.match(/agreement|polic(?:y|ies)|procedure|affiliate|distributor|associate|representative|compliance/gi) || []).length;
    if (agreementSignals < 4) return null;
    return text.slice(0, 240000);
  } catch {
    return null;
  }
}

async function discoverCurrentAgreement(companyName: string, suppliedUrl?: string | null) {
  const directCandidates: Array<{ title: string; url: string; score: number }> = [];
  if (suppliedUrl) directCandidates.push({ title: 'Provided official source', url: suppliedUrl, score: 500 });
  try {
    const query = companyName + ' affiliate agreement policies procedures distributor agreement compliance terms';
    const searchResponse = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 BrandedAlign agreement discovery' },
      signal: AbortSignal.timeout(8000),
    });
    if (searchResponse.ok) {
      const html = await searchResponse.text();
      const anchorPattern = /<a[^>]+class=[\"'][^\"']*result__a[^\"']*[\"'][^>]+href=[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)<\\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = anchorPattern.exec(html)) && directCandidates.length < 14) {
        const url = decodeSearchHref(match[1]);
        if (!url) continue;
        const title = match[2].replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\\s+/g, ' ').trim();
        directCandidates.push({ title, url, score: agreementCandidateScore(companyName, title, url) });
      }
    }
  } catch {}

  const unique = [...new Map(directCandidates.map((candidate) => [candidate.url, candidate])).values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  if (!unique.length) return null;

  const fetched = await Promise.all(unique.map(async (candidate) => ({ candidate, text: await fetchReadableAgreement(candidate.url) })));
  const usable = fetched
    .filter((item): item is { candidate: { title: string; url: string; score: number }; text: string } => Boolean(item.text))
    .map((item) => ({ ...item, quality: item.candidate.score + Math.min(60, (item.text.match(/agreement|polic(?:y|ies)|procedure|affiliate|distributor|associate|representative|compliance/gi) || []).length) }))
    .sort((a, b) => b.quality - a.quality)[0];
  if (!usable) return null;
  const meta = inferAgreementMetadata(usable.text, usable.candidate.title);
  return {
    sourceUrl: usable.candidate.url,
    documentText: usable.text,
    agreementTitle: meta.title,
    agreementVersion: meta.version,
  };
}

async function requireActiveMembership(organizationId: string) {`],
  [`    const rows = parsed.data.parties.map((party) => ({
      organization_id: organizationId,
      review_id: review.id,
      company_name: party.companyName,
      relationship_type: party.relationshipType,
      agreement_title: party.agreementTitle || null,
      agreement_version: party.agreementVersion || null,
      effective_date: party.effectiveDate || null,
      source_url: party.sourceUrl || null,
      document_text: party.documentText?.trim() || null,
      document_status: party.documentText?.trim() ? 'text_provided' : party.sourceUrl ? 'source_link' : 'missing',
    }));`, `    const enrichedParties = await Promise.all(parsed.data.parties.map(async (party) => {
      if (party.documentText?.trim()) return party;
      const discovered = await discoverCurrentAgreement(party.companyName, party.sourceUrl || null);
      if (!discovered) return party;
      return {
        ...party,
        sourceUrl: discovered.sourceUrl,
        documentText: discovered.documentText,
        agreementTitle: party.agreementTitle || discovered.agreementTitle,
        agreementVersion: party.agreementVersion || discovered.agreementVersion || undefined,
      };
    }));

    const rows = enrichedParties.map((party) => ({
      organization_id: organizationId,
      review_id: review.id,
      company_name: party.companyName,
      relationship_type: party.relationshipType,
      agreement_title: party.agreementTitle || null,
      agreement_version: party.agreementVersion || null,
      effective_date: party.effectiveDate || null,
      source_url: party.sourceUrl || null,
      document_text: party.documentText?.trim() || null,
      document_status: party.documentText?.trim() ? 'text_provided' : party.sourceUrl ? 'source_link' : 'missing',
    }));`],
]);

console.log('BrandedAlign live billing, owner-access, and agreement-discovery patch applied');
