-- BrandedAlign backend foundation
-- Additive migration: preserves the currently working ComplianceCrawler tables
-- while adding the canonical backend records required by the TypeScript API.

create extension if not exists pgcrypto;
create schema if not exists private;

-- Existing helper is retained when present. This definition is intentionally
-- idempotent and keeps organization membership checks out of exposed schemas.
create or replace function private.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select om.org_id
  from public.organization_members om
  where om.user_id = (select auth.uid())
$$;
revoke all on function private.user_org_ids() from public;
grant execute on function private.user_org_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Compatibility upgrades for tables that already exist in production.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists plan_key text,
  add column if not exists current_period_start timestamptz;

update public.organizations
set plan_key = coalesce(plan_key, plan_tier)
where plan_key is null;

alter table public.organization_members
  add column if not exists id uuid default gen_random_uuid();

update public.organization_members set id = gen_random_uuid() where id is null;
alter table public.organization_members alter column id set not null;
create unique index if not exists organization_members_id_uidx on public.organization_members(id);
create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists organization_members_org_id_idx on public.organization_members(org_id);

alter table public.sites
  add column if not exists name text,
  add column if not exists normalized_domain text;

update public.sites
set normalized_domain = coalesce(normalized_domain, normalized_host),
    name = coalesce(name, display_name, normalized_host)
where normalized_domain is null or name is null;

-- The existing findings table remains available to the current Python stack.
-- New nullable columns let the Node backend store richer evidence without
-- breaking the old reader paths.
alter table public.findings
  alter column audit_run_id drop not null,
  alter column rule_code set default 'BA_UNCLASSIFIED',
  add column if not exists scan_job_id uuid,
  add column if not exists scan_page_id uuid,
  add column if not exists plain_language_explanation text,
  add column if not exists evidence_excerpt text,
  add column if not exists source_location text,
  add column if not exists recommendation text,
  add column if not exists suggested_revision text,
  add column if not exists confidence numeric;

-- ---------------------------------------------------------------------------
-- New canonical backend tables.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  email_mirror text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_key text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_one_active_stripe_sub_per_org
  on public.subscriptions(organization_id, stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists subscriptions_org_idx on public.subscriptions(organization_id);
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  name text not null,
  offer_type text,
  public_url text,
  description text,
  target_audience text,
  category text,
  disclosure_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_org_idx on public.offers(organization_id);
create index if not exists offers_site_idx on public.offers(site_id);

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  review_type text not null check (review_type in ('just_compliance','full_brand_audit')),
  status text not null default 'Queued' check (status in (
    'Draft','Awaiting verification','Queued','Running','Processing findings',
    'Generating report','Completed','Failed','Canceled'
  )),
  requested_url text not null,
  normalized_target text not null,
  page_limit integer not null check (page_limit > 0 and page_limit <= 500),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  safe_error_code text
);
create index if not exists scan_jobs_org_created_idx on public.scan_jobs(organization_id, created_at desc);
create index if not exists scan_jobs_status_idx on public.scan_jobs(status);

create table if not exists public.scan_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scan_job_id uuid not null references public.scan_jobs(id) on delete cascade,
  normalized_url text not null,
  page_title text,
  http_status integer,
  content_hash text,
  scan_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique(scan_job_id, normalized_url)
);
create index if not exists scan_pages_org_idx on public.scan_pages(organization_id);
create index if not exists scan_pages_job_idx on public.scan_pages(scan_job_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scan_job_id uuid not null unique references public.scan_jobs(id) on delete cascade,
  overall_score numeric,
  compliance_score numeric,
  clarity_score numeric,
  accessibility_score numeric,
  privacy_score numeric,
  technical_score numeric,
  alignment_score numeric,
  summary text,
  generated_at timestamptz not null default now(),
  check (overall_score is null or (overall_score between 0 and 100)),
  check (compliance_score is null or (compliance_score between 0 and 100)),
  check (clarity_score is null or (clarity_score between 0 and 100)),
  check (accessibility_score is null or (accessibility_score between 0 and 100)),
  check (privacy_score is null or (privacy_score between 0 and 100)),
  check (technical_score is null or (technical_score between 0 and 100)),
  check (alignment_score is null or (alignment_score between 0 and 100))
);
create index if not exists reports_org_generated_idx on public.reports(organization_id, generated_at desc);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  billing_period_key text not null,
  scan_job_id uuid references public.scan_jobs(id) on delete set null,
  units_reserved integer not null default 0 check (units_reserved >= 0),
  units_consumed integer not null default 0 check (units_consumed >= 0),
  status text not null check (status in ('reserved','consumed','released','failed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists usage_ledger_org_period_idx on public.usage_ledger(organization_id, billing_period_key);
create index if not exists usage_ledger_scan_idx on public.usage_ledger(scan_job_id);

create table if not exists public.domain_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  method text not null check (method in ('dns_txt','html_file','meta_tag','manual_admin')),
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending','verified','expired','revoked')),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists domain_verifications_org_site_idx on public.domain_verifications(organization_id, site_id);

create table if not exists public.fit_check_results (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id text,
  user_id uuid references auth.users(id) on delete set null,
  score numeric,
  recommendation text,
  consent_level text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null,
  action text not null,
  target_type text,
  target_id text,
  safe_metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create table if not exists private.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processing_status text not null check (processing_status in ('processing','completed','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  safe_error_code text
);

create table if not exists private.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Support','Analyst','Billing Support','Security Administrator','Super Administrator')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists admin_roles_user_active_idx on private.admin_roles(user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- RLS and least-privilege grants.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.offers enable row level security;
alter table public.scan_jobs enable row level security;
alter table public.scan_pages enable row level security;
alter table public.reports enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.domain_verifications enable row level security;
alter table public.fit_check_results enable row level security;
alter table public.audit_logs enable row level security;

-- Existing exposed tenant tables stay protected.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.sites enable row level security;
alter table public.findings enable row level security;

-- Profiles: own row only.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Tenant-owned browser-editable metadata.
drop policy if exists offers_select_member on public.offers;
create policy offers_select_member on public.offers for select to authenticated
using (organization_id in (select private.user_org_ids()));
drop policy if exists offers_insert_member on public.offers;
create policy offers_insert_member on public.offers for insert to authenticated
with check (organization_id in (select private.user_org_ids()));
drop policy if exists offers_update_member on public.offers;
create policy offers_update_member on public.offers for update to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));
drop policy if exists offers_delete_member on public.offers;
create policy offers_delete_member on public.offers for delete to authenticated
using (organization_id in (select private.user_org_ids()));

-- Backend-written records: authenticated clients may only read their own org.
drop policy if exists subscriptions_select_member on public.subscriptions;
create policy subscriptions_select_member on public.subscriptions for select to authenticated
using (organization_id in (select private.user_org_ids()));

drop policy if exists scan_jobs_select_member on public.scan_jobs;
create policy scan_jobs_select_member on public.scan_jobs for select to authenticated
using (organization_id in (select private.user_org_ids()));

drop policy if exists scan_pages_select_member on public.scan_pages;
create policy scan_pages_select_member on public.scan_pages for select to authenticated
using (organization_id in (select private.user_org_ids()));

drop policy if exists reports_select_member on public.reports;
create policy reports_select_member on public.reports for select to authenticated
using (organization_id in (select private.user_org_ids()));

drop policy if exists usage_ledger_select_member on public.usage_ledger;
create policy usage_ledger_select_member on public.usage_ledger for select to authenticated
using (organization_id in (select private.user_org_ids()));

drop policy if exists audit_logs_select_member on public.audit_logs;
create policy audit_logs_select_member on public.audit_logs for select to authenticated
using (organization_id in (select private.user_org_ids()));

-- Domain verification hashes are intentionally server-only. Fit-check results are
-- also server-mediated; no direct browser policies are created.

-- Explicit grants. RLS still limits rows after these grants.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.offers to authenticated;
grant select on public.subscriptions, public.scan_jobs, public.scan_pages, public.reports, public.usage_ledger, public.audit_logs to authenticated;

revoke all on public.domain_verifications from anon, authenticated;
revoke all on public.fit_check_results from anon, authenticated;
revoke all on private.stripe_events from anon, authenticated;
revoke all on private.admin_roles from anon, authenticated;

-- Service role/server remains the writer for protected records.
grant select, insert, update, delete on public.profiles, public.subscriptions, public.offers, public.scan_jobs, public.scan_pages, public.reports, public.usage_ledger, public.domain_verifications, public.fit_check_results, public.audit_logs to service_role;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.stripe_events, private.admin_roles to service_role;

-- ---------------------------------------------------------------------------
-- Atomic quota reservation. This function is server-only and never exposed to
-- anon/authenticated clients.
-- ---------------------------------------------------------------------------

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
  if p_units <= 0 then
    raise exception 'invalid_quota_units';
  end if;

  select * into v_existing
  from public.usage_ledger
  where idempotency_key = p_idempotency_key;

  if found then
    return v_existing;
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    raise exception 'organization_not_found';
  end if;

  if coalesce(v_org.billing_blocked, false) then
    raise exception 'billing_blocked';
  end if;

  if coalesce(v_org.plan_scans_limit, 0) <= 0 then
    raise exception 'scan_quota_unavailable';
  end if;

  select coalesce(sum(case when status in ('reserved','consumed') then greatest(units_reserved, units_consumed) else 0 end),0)
    into v_used
  from public.usage_ledger
  where organization_id = p_organization_id
    and billing_period_key = p_billing_period_key;

  if v_used + p_units > v_org.plan_scans_limit then
    raise exception 'scan_quota_exceeded';
  end if;

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

create or replace function private.reconcile_scan_quota(
  p_scan_job_id uuid,
  p_consumed integer,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('consumed','released','failed') then
    raise exception 'invalid_quota_status';
  end if;

  update public.usage_ledger
  set units_consumed = greatest(coalesce(p_consumed,0),0),
      status = p_status,
      updated_at = now()
  where scan_job_id = p_scan_job_id
    and status = 'reserved';
end;
$$;
revoke all on function private.reconcile_scan_quota(uuid,integer,text) from public, anon, authenticated;
grant execute on function private.reconcile_scan_quota(uuid,integer,text) to service_role;
