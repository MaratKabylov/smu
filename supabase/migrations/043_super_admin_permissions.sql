-- Keep the protected super-admin role authoritative even when an older or
-- manually upgraded database has incomplete role_permissions rows.

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
on conflict do nothing;

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.permissions p
    where p.code = permission_code
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and (
            r.code = 'super_admin'
            or exists (
              select 1
              from public.role_permissions rp
              where rp.role_id = ur.role_id
                and rp.permission_id = p.id
            )
          )
      )
  );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
