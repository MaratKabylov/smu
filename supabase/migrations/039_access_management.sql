-- User and access management is session-bound and atomic. Direct writes to
-- assignment tables would bypass last-super-admin protection and audit.

-- Keep the platform boundary deterministic on upgraded databases. The basic
-- user role never grants administrative authority; admin gets operational
-- permissions; only super_admin keeps critical system permissions.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id and rp.permission_id = p.id
  and (
    r.code = 'user'
    or (r.code <> 'super_admin' and p.code in ('roles.manage','settings.manage','media.purge'))
  );

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='admin' and p.code not in ('roles.manage','settings.manage','media.purge')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='super_admin'
on conflict do nothing;

insert into public.user_roles(user_id,role_id,assigned_by)
select pr.id,r.id,null from public.profiles pr cross join public.roles r
where r.code='user'
on conflict do nothing;

-- New accounts always receive the inert baseline role. The role may not exist
-- before seed on a brand-new database, so the insert deliberately tolerates it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',new.email));
  insert into public.user_roles(user_id,role_id,assigned_by)
  select new.id,r.id,null from public.roles r where r.code='user'
  on conflict do nothing;
  return new;
end;
$$;

drop policy if exists "user_roles_insert_role_manager" on public.user_roles;
drop policy if exists "user_roles_delete_role_manager" on public.user_roles;
drop policy if exists "role_permissions_insert_role_manager" on public.role_permissions;
drop policy if exists "role_permissions_delete_role_manager" on public.role_permissions;
revoke insert,update,delete,truncate on public.user_roles,public.role_permissions
  from public,anon,authenticated,service_role;

create function public.list_access_management(p_page integer default 1,p_query text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_query text:=btrim(coalesce(p_query,''));
  v_result jsonb;
begin
  if v_actor is null or not public.has_permission('admin.access') or not public.has_permission('users.manage') then
    raise exception 'forbidden';
  end if;
  if p_page is null or p_page not between 1 and 10000 or length(v_query)>120 then
    raise exception 'invalid_input';
  end if;
  with filtered as (
    select pr.id,pr.display_name,pr.created_at,u.email
    from public.profiles pr join auth.users u on u.id=pr.id
    where v_query='' or position(lower(v_query) in lower(coalesce(pr.display_name,'')))>0
      or position(lower(v_query) in lower(coalesce(u.email,'')))>0
  ), paged as (
    select * from filtered order by created_at desc,id limit 30 offset (p_page-1)*30
  )
  select jsonb_build_object(
    'page',p_page,'pageSize',30,'total',(select count(*) from filtered),
    'superAdminCount',(select count(*) from public.user_roles ur join public.roles r on r.id=ur.role_id where r.code='super_admin'),
    'users',coalesce((select jsonb_agg(jsonb_build_object(
      'id',x.id,'displayName',x.display_name,'email',x.email,'createdAt',x.created_at,
      'roles',coalesce((select jsonb_agg(r.code order by r.code) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=x.id),'[]'::jsonb)
    ) order by x.created_at desc,x.id) from paged x),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object(
      'code',r.code,'name',r.name,'protected',r.code in ('user','admin','super_admin'),
      'permissions',coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb)
    ) order by r.created_at,r.code) from public.roles r),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(jsonb_build_object('code',p.code,'name',p.name) order by p.code) from public.permissions p),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create function public.set_user_roles(p_user_id uuid,p_role_codes text[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_requested text[];
  v_old text[];
begin
  if v_actor is null or not public.has_permission('admin.access')
    or not public.has_permission('users.manage') or not public.has_permission('roles.manage') then
    raise exception 'forbidden';
  end if;
  if p_user_id is null or p_role_codes is null or cardinality(p_role_codes)>50
    or array_position(p_role_codes,null) is not null then raise exception 'invalid_roles'; end if;
  select coalesce(array_agg(distinct requested.code order by requested.code),'{}'::text[]) into v_requested
  from unnest(p_role_codes) requested(code);
  if cardinality(v_requested)<>cardinality(p_role_codes) or not ('user'=any(v_requested))
    or exists(select 1 from unnest(v_requested) requested(code) left join public.roles r on r.code=requested.code where r.id is null) then
    raise exception 'invalid_roles';
  end if;

  lock table public.user_roles in share row exclusive mode;
  -- The caller may have waited for another role change. Recheck authority
  -- under the same lock that protects the final-super-admin invariant.
  if not public.has_permission('admin.access') or not public.has_permission('users.manage')
    or not public.has_permission('roles.manage') then raise exception 'forbidden'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'not_found'; end if;
  select coalesce(array_agg(r.code order by r.code),'{}'::text[]) into v_old
  from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id;
  if 'super_admin'=any(v_old) and not ('super_admin'=any(v_requested))
    and (select count(*) from public.user_roles ur join public.roles r on r.id=ur.role_id where r.code='super_admin')<=1 then
    raise exception 'last_super_admin';
  end if;
  if v_old=v_requested then return false; end if;

  delete from public.user_roles ur using public.roles r
  where ur.user_id=p_user_id and r.id=ur.role_id and not (r.code=any(v_requested));
  insert into public.user_roles(user_id,role_id,assigned_by)
  select p_user_id,r.id,v_actor from public.roles r
  where r.code=any(v_requested)
  on conflict do nothing;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
  values(v_actor,'profile',p_user_id,'roles_updated',jsonb_build_object('roles',to_jsonb(v_old)),jsonb_build_object('roles',to_jsonb(v_requested)));
  return true;
end;
$$;

create function public.set_role_permissions(p_role_code text,p_permission_codes text[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_role_id uuid;
  v_requested text[];
  v_old text[];
begin
  if v_actor is null or not public.has_permission('admin.access') or not public.has_permission('roles.manage') then
    raise exception 'forbidden';
  end if;
  -- Serialize with role assignment changes and recheck after waiting, so a
  -- revoked super_admin cannot complete a stale permission mutation.
  lock table public.user_roles in share row exclusive mode;
  if not public.has_permission('admin.access') or not public.has_permission('roles.manage') then
    raise exception 'forbidden';
  end if;
  if p_role_code is null or p_permission_codes is null or cardinality(p_permission_codes)>100
    or array_position(p_permission_codes,null) is not null then raise exception 'invalid_permissions'; end if;
  if p_role_code in ('user','admin','super_admin') then raise exception 'protected_role'; end if;
  select id into v_role_id from public.roles where code=p_role_code for update;
  if v_role_id is null then raise exception 'not_found'; end if;
  select coalesce(array_agg(distinct requested.code order by requested.code),'{}'::text[]) into v_requested
  from unnest(p_permission_codes) requested(code);
  if cardinality(v_requested)<>cardinality(p_permission_codes)
    or exists(select 1 from unnest(v_requested) requested(code) left join public.permissions p on p.code=requested.code where p.id is null)
    or v_requested && array['roles.manage','settings.manage','media.purge']::text[] then
    raise exception 'invalid_permissions';
  end if;
  select coalesce(array_agg(p.code order by p.code),'{}'::text[]) into v_old
  from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=v_role_id;
  if v_old=v_requested then return false; end if;
  delete from public.role_permissions where role_id=v_role_id;
  insert into public.role_permissions(role_id,permission_id)
  select v_role_id,p.id from public.permissions p where p.code=any(v_requested);
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
  values(v_actor,'role',v_role_id,'role_permissions_updated',
    jsonb_build_object('role',p_role_code,'permissions',to_jsonb(v_old)),
    jsonb_build_object('role',p_role_code,'permissions',to_jsonb(v_requested)));
  return true;
end;
$$;

revoke all on function public.list_access_management(integer,text) from public,anon,authenticated,service_role;
revoke all on function public.set_user_roles(uuid,text[]) from public,anon,authenticated,service_role;
revoke all on function public.set_role_permissions(text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.list_access_management(integer,text) to authenticated;
grant execute on function public.set_user_roles(uuid,text[]) to authenticated;
grant execute on function public.set_role_permissions(text,text[]) to authenticated;
