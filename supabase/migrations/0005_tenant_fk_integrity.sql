-- BrandedAlign tenant-integrity hardening.
-- Application checks and RLS are not enough by themselves: the database must
-- reject cross-organization references even if trusted application code errs.

create unique index if not exists sites_org_id_id_uidx
  on public.sites(org_id, id);
create unique index if not exists scan_jobs_org_id_id_uidx
  on public.scan_jobs(organization_id, id);
create unique index if not exists scan_pages_org_id_id_uidx
  on public.scan_pages(organization_id, id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_org_site_fkey') then
    alter table public.offers add constraint offers_org_site_fkey
      foreign key (organization_id, site_id)
      references public.sites(org_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'scan_jobs_org_site_fkey') then
    alter table public.scan_jobs add constraint scan_jobs_org_site_fkey
      foreign key (organization_id, site_id)
      references public.sites(org_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'scan_pages_org_job_fkey') then
    alter table public.scan_pages add constraint scan_pages_org_job_fkey
      foreign key (organization_id, scan_job_id)
      references public.scan_jobs(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'reports_org_job_fkey') then
    alter table public.reports add constraint reports_org_job_fkey
      foreign key (organization_id, scan_job_id)
      references public.scan_jobs(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'usage_ledger_org_job_fkey') then
    alter table public.usage_ledger add constraint usage_ledger_org_job_fkey
      foreign key (organization_id, scan_job_id)
      references public.scan_jobs(organization_id, id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'domain_verifications_org_site_fkey') then
    alter table public.domain_verifications add constraint domain_verifications_org_site_fkey
      foreign key (organization_id, site_id)
      references public.sites(org_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'findings_org_scan_job_fkey') then
    alter table public.findings add constraint findings_org_scan_job_fkey
      foreign key (org_id, scan_job_id)
      references public.scan_jobs(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'findings_org_scan_page_fkey') then
    alter table public.findings add constraint findings_org_scan_page_fkey
      foreign key (org_id, scan_page_id)
      references public.scan_pages(organization_id, id) on delete cascade;
  end if;
end
$$;
