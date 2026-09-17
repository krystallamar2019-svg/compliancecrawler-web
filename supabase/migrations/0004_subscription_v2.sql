-- Non-breaking subscription entitlement updater for the TypeScript backend.
-- The existing apply_stripe_subscription RPC remains untouched for the live
-- Python stack.

create or replace function public.apply_stripe_subscription_v2(
  p_org_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_livemode boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_has_plan boolean := false;
  v_blocked boolean;
  v_plan_key text := 'free';
begin
  if p_status not in ('inactive','incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused') then
    raise exception 'unsupported_subscription_status';
  end if;

  if p_price_id is not null then
    select * into v_plan
    from public.subscription_plans
    where is_active = true
      and ((p_livemode = true and stripe_live_price_id = p_price_id)
        or (p_livemode = false and stripe_test_price_id = p_price_id))
    limit 1;
    v_has_plan := found;
  end if;

  if v_has_plan then
    v_plan_key := v_plan.plan_key;
  end if;

  v_blocked := p_status not in ('trialing','active') or not v_has_plan;

  update public.organizations
  set stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
      stripe_subscription_id = p_subscription_id,
      stripe_price_id = p_price_id,
      subscription_status = p_status,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
      billing_blocked = v_blocked,
      plan_tier = v_plan_key,
      plan_key = v_plan_key,
      plan_scans_limit = case when v_has_plan then v_plan.scans_per_cycle else 0 end,
      max_sites = case when v_has_plan then v_plan.max_sites else 0 end,
      max_pages = case when v_has_plan then v_plan.max_pages else 10 end,
      max_depth = case when v_has_plan then v_plan.max_depth else 1 end,
      max_concurrent_jobs = case when v_has_plan then v_plan.max_concurrent_jobs else 1 end,
      cycle_reset_date = p_current_period_end,
      updated_at = now()
  where id = p_org_id;

  if not found then
    raise exception 'organization_not_found';
  end if;

  return v_plan_key;
end;
$$;

revoke all on function public.apply_stripe_subscription_v2(uuid,text,text,text,text,timestamptz,timestamptz,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_v2(uuid,text,text,text,text,timestamptz,timestamptz,boolean,boolean)
  to service_role;
