-- BrandedAlign backend hardening and atomic scan reservation.

alter table public.subscriptions
  add column if not exists livemode boolean not null default false;

alter table public.scan_jobs
  add column if not exists idempotency_key text;

alter table public.usage_ledger
  drop constraint if exists usage_ledger_idempotency_key_key;
create unique index if not exists usage_ledger_org_idempotency_uidx
  on public.usage_ledger(organization_id, idempotency_key);
create unique index if not exists scan_jobs_org_idempotency_uidx
  on public.scan_jobs(organization_id, idempotency_key)
  where idempotency_key is not null;

-- Add canonical FKs to the compatibility-extended findings table without
-- disturbing legacy rows used by the existing Python stack.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'findings_scan_job_id_fkey'
  ) then
    alter table public.findings
      add constraint findings_scan_job_id_fkey
      foreign key (scan_job_id) references public.scan_jobs(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'findings_scan_page_id_fkey'
  ) then
    alter table public.findings
      add constraint findings_scan_page_id_fkey
      foreign key (scan_page_id) references public.scan_pages(id) on delete cascade;
  end if;
end
$$;

-- Existing RLS policies call a private helper; authenticated users only need
-- schema USAGE plus EXECUTE on the specific helper function.
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.user_org_ids() to authenticated, service_role;

-- Server-only transaction that prevents quota races and duplicate consumption.
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
  if p_review_type not in ('just_compliance','full_brand_audit') then
    raise exception 'invalid_review_type';
  end if;
  if p_page_limit <= 0 or p_page_limit > 500 then
    raise exception 'invalid_page_limit';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key';
  end if;

  select sj.* into v_existing
  from public.scan_jobs sj
  where sj.organization_id = p_organization_id
    and sj.idempotency_key = p_idempotency_key
  limit 1;
  if found then
    return v_existing;
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id
  for update;
  if not found then raise exception 'organization_not_found'; end if;

  if coalesce(v_org.billing_blocked, false)
     or coalesce(v_org.subscription_status, 'inactive') not in ('active','trialing') then
    raise exception 'active_subscription_required';
  end if;

  if coalesce(v_org.plan_scans_limit, 0) <= 0 then
    raise exception 'scan_quota_unavailable';
  end if;

  select coalesce(sum(
    case when status in ('reserved','consumed')
      then greatest(units_reserved, units_consumed)
      else 0 end
  ), 0)
  into v_used
  from public.usage_ledger
  where organization_id = p_organization_id
    and billing_period_key = p_billing_period_key;

  if v_used + 1 > v_org.plan_scans_limit then
    raise exception 'scan_quota_exceeded';
  end if;

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
