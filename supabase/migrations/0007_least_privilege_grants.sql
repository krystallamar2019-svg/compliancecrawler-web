-- Supabase may grant broad public-schema table privileges by default.
-- RLS still protects rows, but BrandedAlign also enforces least privilege at
-- the table grant layer.

revoke all on public.profiles from public, anon, authenticated;
revoke all on public.subscriptions from public, anon, authenticated;
revoke all on public.offers from public, anon, authenticated;
revoke all on public.scan_jobs from public, anon, authenticated;
revoke all on public.scan_pages from public, anon, authenticated;
revoke all on public.reports from public, anon, authenticated;
revoke all on public.usage_ledger from public, anon, authenticated;
revoke all on public.domain_verifications from public, anon, authenticated;
revoke all on public.fit_check_results from public, anon, authenticated;
revoke all on public.audit_logs from public, anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.offers to authenticated;
grant select on public.subscriptions, public.scan_jobs, public.scan_pages,
  public.reports, public.usage_ledger to authenticated;

-- Server-only tables are explicitly writable by service_role.
grant select, insert, update, delete on public.profiles, public.subscriptions,
  public.offers, public.scan_jobs, public.scan_pages, public.reports,
  public.usage_ledger, public.domain_verifications, public.fit_check_results,
  public.audit_logs to service_role;
