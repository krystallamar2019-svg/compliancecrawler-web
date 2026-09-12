-- BrandedAlign defense-in-depth and concurrency hardening.

-- Private operational tables are server-only. RLS remains enabled even though
-- the private schema is not browser-exposed and service_role is the only writer.
alter table private.stripe_events enable row level security;
alter table private.admin_roles enable row level security;
revoke all on private.stripe_events from public, anon, authenticated;
revoke all on private.admin_roles from public, anon, authenticated;

-- Customer members do not need raw audit-log access. Admin-facing audit views
-- are mediated by the backend so safe_metadata and IP hashes are never exposed
-- merely because someone is an organization member.
revoke all on public.audit_logs from anon, authenticated;

-- Prevent duplicate simultaneously-active admin roles for the same person.
create unique index if not exists admin_roles_user_role_active_uidx
  on private.admin_roles(user_id, role)
  where revoked_at is null;

-- Confidence values are normalized to 0..1 by the screening engine.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'findings_confidence_range_check') then
    alter table public.findings
      add constraint findings_confidence_range_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end
$$;

-- Keep the legacy helper correct under organization-scoped idempotency.
create or replace function private.reserve_scan_quota(
  p_organization_id uuid,
  p_scan_job_id uuid,
  p_units integer,
  p_idempotency_key text,
  p_billing_period_key text
)
returns public.usage_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_used bigint;
  v_existing public.usage_ledger%rowtype;
  v_row public.usage_ledger%rowtype;
begin
  if p_units <= 0 then raise exception 'invalid_quota_units'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_billing_period_key is null or length(p_billing_period_key) = 0 then
    raise exception 'invalid_billing_period_key';
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id
  for update;
  if not found then raise exception 'organization_not_found'; end if;

  select * into v_existing
  from public.usage_ledger
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  if coalesce(v_org.billing_blocked, false) then raise exception 'billing_blocked'; end if;
  if coalesce(v_org.plan_scans_limit, 0) <= 0 then raise exception 'scan_quota_unavailable'; end if;

  select coalesce(sum(case when status in ('reserved','consumed') then greatest(units_reserved, units_consumed) else 0 end), 0)
    into v_used
  from public.usage_ledger
  where organization_id = p_organization_id
    and billing_period_key = p_billing_period_key;

  if v_used + p_units > v_org.plan_scans_limit then raise exception 'scan_quota_exceeded'; end if;

  insert into public.usage_ledger(
    organization_id, billing_period_key, scan_job_id,
    units_reserved, units_consumed, status, idempotency_key
  ) values (
    p_organization_id, p_billing_period_key, p_scan_job_id,
    p_units, 0, 'reserved', p_idempotency_key
  ) returning * into v_row;

  return v_row;
end;
$$;
revoke all on function private.reserve_scan_quota(uuid,uuid,integer,text,text) from public, anon, authenticated;
grant execute on function private.reserve_scan_quota(uuid,uuid,integer,text,text) to service_role;

-- Atomic scan creation. The organization row is locked before the idempotency
-- lookup so two simultaneous identical requests serialize and both resolve to
-- the same scan instead of one failing a unique constraint race.
create or replace function public.create_scan_job_with_quota(
  p_organization_id uuid,
  p_site_id uuid,
  p_requested_by uuid,
  p_review_type text,
  p_requested_url text,
  p_normalized_target text,
  p_page_limit integer,
  p_billing_period_key text,
  p_idempotency_key text
)
returns public.scan_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_used bigint;
  v_existing public.scan_jobs%rowtype;
  v_job public.scan_jobs%rowtype;
begin
  if p_review_type not in ('just_compliance','full_brand_audit') then raise exception 'invalid_review_type'; end if;
  if p_page_limit <= 0 or p_page_limit > 500 then raise exception 'invalid_page_limit'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_billing_period_key is null or length(p_billing_period_key) = 0 then
    raise exception 'invalid_billing_period_key';
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id
  for update;
  if not found then raise exception 'organization_not_found'; end if;

  select sj.* into v_existing
  from public.scan_jobs sj
  where sj.organization_id = p_organization_id
    and sj.idempotency_key = p_idempotency_key
  limit 1;
  if found then return v_existing; end if;

  if coalesce(v_org.billing_blocked, false)
     or coalesce(v_org.subscription_status, 'inactive') not in ('active','trialing') then
    raise exception 'active_subscription_required';
  end if;
  if coalesce(v_org.plan_scans_limit, 0) <= 0 then raise exception 'scan_quota_unavailable'; end if;

  select coalesce(sum(
    case when status in ('reserved','consumed') then greatest(units_reserved, units_consumed) else 0 end
  ), 0)
  into v_used
  from public.usage_ledger
  where organization_id = p_organization_id
    and billing_period_key = p_billing_period_key;

  if v_used + 1 > v_org.plan_scans_limit then raise exception 'scan_quota_exceeded'; end if;

  insert into public.scan_jobs(
    organization_id, site_id, requested_by, review_type, status,
    requested_url, normalized_target, page_limit, idempotency_key
  ) values (
    p_organization_id, p_site_id, p_requested_by, p_review_type, 'Queued',
    p_requested_url, p_normalized_target, p_page_limit, p_idempotency_key
  ) returning * into v_job;

  insert into public.usage_ledger(
    organization_id, billing_period_key, scan_job_id,
    units_reserved, units_consumed, status, idempotency_key
  ) values (
    p_organization_id, p_billing_period_key, v_job.id,
    1, 0, 'reserved', p_idempotency_key
  );

  return v_job;
end;
$$;
revoke all on function public.create_scan_job_with_quota(uuid,uuid,uuid,text,text,text,integer,text,text)
  from public, anon, authenticated;
grant execute on function public.create_scan_job_with_quota(uuid,uuid,uuid,text,text,text,integer,text,text)
  to service_role;
