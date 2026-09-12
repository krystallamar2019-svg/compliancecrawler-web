import { Router } from 'express';
import { z } from 'zod';
import { enqueueScan } from '../queue/scanQueue.js';
import { assertSafeDestination } from '../security/urlSafety.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const scansRouter = Router();

const createScanSchema = z.object({
  reviewType: z.enum(['just_compliance', 'full_brand_audit']),
  url: z.string().min(1).max(2_048),
  siteId: z.string().uuid().optional(),
});

function safeDbErrorCode(message: string | undefined) {
  const known = [
    'active_subscription_required',
    'scan_quota_unavailable',
    'scan_quota_exceeded',
    'invalid_idempotency_key',
    'invalid_review_type',
    'invalid_page_limit',
  ];
  return known.find((code) => message?.includes(code));
}

scansRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createScanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_SCAN_REQUEST' });
      return;
    }

    const idempotencyKey = req.header('idempotency-key')?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
      return;
    }

    const { userId, organizationId } = (req as AuthenticatedRequest).auth;
    const destination = await assertSafeDestination(parsed.data.url);

    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('subscription_status,billing_blocked,plan_scans_limit,max_pages,current_period_end,cycle_reset_date')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;

    let siteId: string | null = parsed.data.siteId ?? null;
    let pageLimit = 1;

    if (parsed.data.reviewType === 'full_brand_audit') {
      if (!siteId) {
        res.status(400).json({ error: 'VERIFIED_SITE_REQUIRED' });
        return;
      }

      const { data: site, error: siteError } = await supabaseAdmin
        .from('sites')
        .select('id,normalized_host,normalized_domain,verification_status,is_active')
        .eq('id', siteId)
        .eq('org_id', organizationId)
        .maybeSingle();
      if (siteError) throw siteError;
      if (!site || !site.is_active || site.verification_status !== 'verified') {
        res.status(403).json({ error: 'VERIFIED_SITE_REQUIRED' });
        return;
      }

      const siteHost = String(site.normalized_domain ?? site.normalized_host ?? '').toLowerCase();
      if (!siteHost || siteHost !== destination.url.hostname.toLowerCase()) {
        res.status(400).json({ error: 'SCAN_TARGET_SITE_MISMATCH' });
        return;
      }

      // Initial crawler safety ceiling. It can be raised after load testing even
      // when a paid plan's commercial page allowance is higher.
      pageLimit = Math.min(Math.max(Number(organization.max_pages) || 1, 1), 500);
    }

    const periodKey = String(
      organization.current_period_end ??
      organization.cycle_reset_date ??
      new Date().toISOString().slice(0, 7),
    );

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_scan_job_with_quota', {
      p_organization_id: organizationId,
      p_site_id: siteId,
      p_requested_by: userId,
      p_review_type: parsed.data.reviewType,
      p_requested_url: parsed.data.url,
      p_normalized_target: destination.url.toString(),
      p_page_limit: pageLimit,
      p_billing_period_key: periodKey,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcError) {
      const code = safeDbErrorCode(rpcError.message);
      if (code === 'scan_quota_exceeded') {
        res.status(429).json({ error: 'SCAN_QUOTA_EXCEEDED' });
        return;
      }
      if (code === 'active_subscription_required' || code === 'scan_quota_unavailable') {
        res.status(402).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
        return;
      }
      if (code) {
        res.status(400).json({ error: code.toUpperCase() });
        return;
      }
      throw rpcError;
    }

    const scan = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!scan?.id) throw new Error('SCAN_JOB_CREATION_FAILED');

    try {
      await enqueueScan({ scanId: scan.id, organizationId });
    } catch (error) {
      await Promise.all([
        supabaseAdmin.from('scan_jobs').update({
          status: 'Failed',
          failed_at: new Date().toISOString(),
          safe_error_code: 'QUEUE_UNAVAILABLE',
        }).eq('id', scan.id).eq('organization_id', organizationId),
        supabaseAdmin.from('usage_ledger').update({
          status: 'released',
          units_consumed: 0,
          updated_at: new Date().toISOString(),
        }).eq('scan_job_id', scan.id).eq('organization_id', organizationId),
      ]);
      throw error;
    }

    res.status(202).json({ scanId: scan.id, status: scan.status ?? 'Queued' });
  } catch (error) {
    next(error);
  }
});

scansRouter.get('/', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const from = (page - 1) * pageSize;

    const { data, error, count } = await supabaseAdmin
      .from('scan_jobs')
      .select('id,review_type,status,requested_url,page_limit,created_at,started_at,completed_at,failed_at,safe_error_code', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    res.json({ scans: data ?? [], page, pageSize, total: count ?? 0 });
  } catch (error) {
    next(error);
  }
});

scansRouter.get('/:id', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const { data, error } = await supabaseAdmin
      .from('scan_jobs')
      .select('id,review_type,status,requested_url,page_limit,created_at,started_at,completed_at,failed_at,safe_error_code')
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'SCAN_NOT_FOUND' });
      return;
    }
    res.json(data);
  } catch (error) {
    next(error);
  }
});
