import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { Router } from 'express';
import { z } from 'zod';
import { hashVerificationToken, pageContainsVerificationMeta, verificationTokenMatches } from '../security/domainVerification.js';
import { safeFetchText } from '../security/safeFetch.js';
import { assertSafeDestination } from '../security/urlSafety.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const sitesRouter = Router();

const createSiteSchema = z.object({
  url: z.string().min(1).max(2_048),
  name: z.string().trim().min(1).max(200).optional(),
});

const startVerificationSchema = z.object({
  method: z.enum(['dns_txt', 'html_file', 'meta_tag']),
});

const checkVerificationSchema = z.object({
  token: z.string().min(20).max(512),
});

async function getOwnedSite(siteId: string, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('sites')
    .select('id,org_id,url,normalized_host,normalized_domain,verification_status,is_active')
    .eq('id', siteId)
    .eq('org_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

sitesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_SITE_REQUEST' });
      return;
    }

    const { organizationId, userId } = (req as AuthenticatedRequest).auth;
    const destination = await assertSafeDestination(parsed.data.url);

    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('max_sites,subscription_status,billing_blocked')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;

    const maxSites = Number(organization.max_sites) || 0;
    if (organization.billing_blocked || !['active', 'trialing'].includes(organization.subscription_status) || maxSites <= 0) {
      res.status(402).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
      return;
    }

    const { count, error: countError } = await supabaseAdmin
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', organizationId)
      .eq('is_active', true);
    if (countError) throw countError;
    if ((count ?? 0) >= maxSites) {
      res.status(409).json({ error: 'SITE_LIMIT_REACHED' });
      return;
    }

    const hostname = destination.url.hostname.toLowerCase();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('sites')
      .select('id,verification_status')
      .eq('org_id', organizationId)
      .eq('normalized_host', hostname)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      res.status(409).json({ error: 'SITE_ALREADY_EXISTS', siteId: existing.id });
      return;
    }

    const { data: site, error } = await supabaseAdmin
      .from('sites')
      .insert({
        org_id: organizationId,
        url: destination.url.toString(),
        normalized_host: hostname,
        normalized_domain: hostname,
        display_name: parsed.data.name ?? hostname,
        name: parsed.data.name ?? hostname,
        created_by: userId,
        verification_status: 'unverified',
        is_active: true,
      })
      .select('id,url,normalized_host,verification_status,created_at')
      .single();
    if (error) throw error;

    res.status(201).json(site);
  } catch (error) {
    next(error);
  }
});

sitesRouter.post('/:id/verify', async (req, res, next) => {
  try {
    const parsed = startVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_VERIFICATION_METHOD' });
      return;
    }

    const { organizationId } = (req as AuthenticatedRequest).auth;
    const site = await getOwnedSite(req.params.id, organizationId);
    if (!site || !site.is_active) {
      res.status(404).json({ error: 'SITE_NOT_FOUND' });
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('domain_verifications')
      .update({ status: 'revoked' })
      .eq('organization_id', organizationId)
      .eq('site_id', site.id)
      .eq('status', 'pending');

    const { error: insertError } = await supabaseAdmin.from('domain_verifications').insert({
      organization_id: organizationId,
      site_id: site.id,
      method: parsed.data.method,
      token_hash: hashVerificationToken(token),
      status: 'pending',
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    await supabaseAdmin.from('sites').update({
      verification_status: 'pending',
      verification_method: parsed.data.method,
      verification_checked_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', site.id).eq('org_id', organizationId);

    const host = String(site.normalized_domain ?? site.normalized_host);
    const origin = new URL(site.url);

    res.status(201).json({
      siteId: site.id,
      method: parsed.data.method,
      token,
      expiresAt,
      instructions: {
        dnsTxt: {
          name: `_brandedalign-verification.${host}`,
          value: `brandedalign-verification=${token}`,
        },
        htmlFile: {
          url: new URL('/.well-known/brandedalign-verification.txt', origin).toString(),
          content: `brandedalign-verification=${token}`,
        },
        metaTag: `<meta name="brandedalign-verification" content="${token}">`,
      },
    });
  } catch (error) {
    next(error);
  }
});

sitesRouter.post('/:id/verify/check', async (req, res, next) => {
  try {
    const parsed = checkVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VERIFICATION_TOKEN_REQUIRED' });
      return;
    }

    const { organizationId } = (req as AuthenticatedRequest).auth;
    const site = await getOwnedSite(req.params.id, organizationId);
    if (!site || !site.is_active) {
      res.status(404).json({ error: 'SITE_NOT_FOUND' });
      return;
    }

    const { data: verification, error: verificationError } = await supabaseAdmin
      .from('domain_verifications')
      .select('id,method,token_hash,status,expires_at')
      .eq('organization_id', organizationId)
      .eq('site_id', site.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (verificationError) throw verificationError;
    if (!verification || !verificationTokenMatches(parsed.data.token, verification.token_hash)) {
      res.status(400).json({ error: 'VERIFICATION_TOKEN_INVALID' });
      return;
    }

    if (new Date(verification.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.from('domain_verifications').update({ status: 'expired' }).eq('id', verification.id);
      res.status(410).json({ error: 'VERIFICATION_EXPIRED' });
      return;
    }

    const token = parsed.data.token;
    const expected = `brandedalign-verification=${token}`;
    const host = String(site.normalized_domain ?? site.normalized_host);
    let verified = false;

    if (verification.method === 'dns_txt') {
      try {
        const records = await resolveTxt(`_brandedalign-verification.${host}`);
        verified = records.map((parts) => parts.join('')).some((value) => value.trim() === expected);
      } catch {
        verified = false;
      }
    } else if (verification.method === 'html_file') {
      const target = new URL('/.well-known/brandedalign-verification.txt', site.url).toString();
      const response = await safeFetchText(target);
      verified = response.status >= 200 && response.status < 300 && response.body.trim().includes(expected);
    } else if (verification.method === 'meta_tag') {
      const response = await safeFetchText(site.url);
      verified = pageContainsVerificationMeta(response.body, token);
    }

    const checkedAt = new Date().toISOString();
    await supabaseAdmin.from('sites').update({ verification_checked_at: checkedAt, updated_at: checkedAt }).eq('id', site.id).eq('org_id', organizationId);

    if (!verified) {
      res.status(409).json({ verified: false, error: 'VERIFICATION_NOT_FOUND' });
      return;
    }

    await Promise.all([
      supabaseAdmin.from('domain_verifications').update({ status: 'verified', verified_at: checkedAt }).eq('id', verification.id),
      supabaseAdmin.from('sites').update({ verification_status: 'verified', verified_at: checkedAt, verification_checked_at: checkedAt, updated_at: checkedAt }).eq('id', site.id).eq('org_id', organizationId),
    ]);

    res.json({ verified: true, siteId: site.id, verifiedAt: checkedAt });
  } catch (error) {
    next(error);
  }
});
