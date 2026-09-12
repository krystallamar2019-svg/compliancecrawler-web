-- BrandedAlign development/test seed data.
-- No personal information. Existing production plan rows are left untouched.

insert into public.subscription_plans(
  plan_key,
  display_name,
  is_active,
  scans_per_cycle,
  max_pages,
  max_depth,
  max_concurrent_jobs,
  max_sites
)
values
  ('steward', 'Steward', true, 10, 100, 3, 1, 3),
  ('harvest', 'Harvest', true, 30, 500, 5, 2, 10),
  ('abundance', 'Abundance', true, 100, 1000, 6, 4, 40)
on conflict (plan_key) do update set
  display_name = excluded.display_name,
  scans_per_cycle = excluded.scans_per_cycle,
  max_pages = excluded.max_pages,
  max_depth = excluded.max_depth,
  max_concurrent_jobs = excluded.max_concurrent_jobs,
  max_sites = excluded.max_sites,
  updated_at = now();

-- Intentionally do not seed Stripe price IDs, organizations, users, reports,
-- findings, scans, analytics, or payment state. Those must come from connected
-- services or explicit test fixtures.
