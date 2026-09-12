-- Server-only bridge for private admin role storage.

create or replace function public.get_active_admin_roles(p_user_id uuid)
returns table(role text)
language sql
stable
security definer
set search_path = ''
as $$
  select ar.role
  from private.admin_roles ar
  where ar.user_id = p_user_id
    and ar.revoked_at is null
  order by ar.created_at asc
$$;

revoke all on function public.get_active_admin_roles(uuid) from public, anon, authenticated;
grant execute on function public.get_active_admin_roles(uuid) to service_role;
