import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const usageRouter = Router();

usageRouter.get('/', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('plan_tier,plan_key,plan_scans_limit,max_sites,max_pages,max_depth,max_concurrent_jobs,current_period_end,cycle_reset_date')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;

    const periodKey = String(
      organization.current_period_end ??
      organization.cycle_reset_date ??
      new Date().toISOString().slice(0, 7),
    );

    const { data: ledger, error: ledgerError } = await supabaseAdmin
      .from('usage_ledger')
      .select('units_reserved,units_consumed,status')
      .eq('organization_id', organizationId)
      .eq('billing_period_key', periodKey);
    if (ledgerError) throw ledgerError;

    const consumed = (ledger ?? []).reduce((sum, row) => sum + (row.status === 'consumed' ? Number(row.units_consumed) || 0 : 0), 0);
    const reserved = (ledger ?? []).reduce((sum, row) => sum + (row.status === 'reserved' ? Number(row.units_reserved) || 0 : 0), 0);
    const limit = Number(organization.plan_scans_limit) || 0;

    res.json({
      plan: organization.plan_key ?? organization.plan_tier,
      billingPeriodKey: periodKey,
      scans: {
        consumed,
        reserved,
        remaining: Math.max(limit - consumed - reserved, 0),
        limit,
      },
      limits: {
        sites: Number(organization.max_sites) || 0,
        pages: Number(organization.max_pages) || 0,
        depth: Number(organization.max_depth) || 0,
        concurrentJobs: Number(organization.max_concurrent_jobs) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});
