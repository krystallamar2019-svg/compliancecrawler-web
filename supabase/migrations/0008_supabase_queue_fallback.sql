-- Durable Postgres queue fallback for Railway environments without Redis.
-- BullMQ remains preferred when REDIS_URL is configured.

alter table public.scan_jobs
  add column if not exists worker_attempts integer not null default 0,
  add column if not exists lease_expires_at timestamptz;

alter table public.scan_jobs
  drop constraint if exists scan_jobs_worker_attempts_check;
alter table public.scan_jobs
  add constraint scan_jobs_worker_attempts_check
  check (worker_attempts >= 0 and worker_attempts <= 100);

create index if not exists scan_jobs_queue_claim_idx
  on public.scan_jobs(status, lease_expires_at, created_at)
  where status in ('Queued','Running','Processing findings','Generating report');

create or replace function public.claim_next_scan_job(
  p_lease_seconds integer default 900
)
returns public.scan_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.scan_jobs%rowtype;
begin
  if p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception 'invalid_lease_seconds';
  end if;

  select sj.* into v_job
  from public.scan_jobs sj
  where sj.worker_attempts < 3
    and (
      sj.status = 'Queued'
      or (
        sj.status in ('Running','Processing findings','Generating report')
        and sj.lease_expires_at is not null
        and sj.lease_expires_at < now()
      )
    )
  order by sj.created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.scan_jobs
  set status = 'Running',
      worker_attempts = worker_attempts + 1,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(started_at, now()),
      failed_at = null,
      safe_error_code = null
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_next_scan_job(integer)
  from public, anon, authenticated;
grant execute on function public.claim_next_scan_job(integer)
  to service_role;

create or replace function public.renew_scan_job_lease(
  p_scan_job_id uuid,
  p_organization_id uuid,
  p_lease_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception 'invalid_lease_seconds';
  end if;

  update public.scan_jobs
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where id = p_scan_job_id
    and organization_id = p_organization_id
    and status in ('Running','Processing findings','Generating report');

  return found;
end;
$$;

revoke all on function public.renew_scan_job_lease(uuid,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.renew_scan_job_lease(uuid,uuid,integer)
  to service_role;
