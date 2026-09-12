import { Router } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const meRouter = Router();

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
