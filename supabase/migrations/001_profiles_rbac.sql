create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code)),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code)),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index user_roles_user_id_idx on public.user_roles(user_id);
create index user_roles_role_id_idx on public.user_roles(role_id);
create index role_permissions_role_id_idx on public.role_permissions(role_id);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.code = permission_code
  );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_read_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.has_permission('admin.access'));

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "roles_read_authenticated"
on public.roles for select
to authenticated
using (true);

create policy "permissions_read_authenticated"
on public.permissions for select
to authenticated
using (true);

create policy "user_roles_read_self_or_manager"
on public.user_roles for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_permission('users.manage')
);

create policy "user_roles_insert_role_manager"
on public.user_roles for insert
to authenticated
with check (public.has_permission('roles.manage'));

create policy "user_roles_delete_role_manager"
on public.user_roles for delete
to authenticated
using (public.has_permission('roles.manage'));

create policy "role_permissions_read_authenticated"
on public.role_permissions for select
to authenticated
using (true);

create policy "role_permissions_insert_role_manager"
on public.role_permissions for insert
to authenticated
with check (public.has_permission('roles.manage'));

create policy "role_permissions_delete_role_manager"
on public.role_permissions for delete
to authenticated
using (public.has_permission('roles.manage'));

create policy "audit_logs_read_authorized"
on public.audit_logs for select
to authenticated
using (public.has_permission('audit.read'));

comment on table public.audit_logs is
  'Append-only audit trail. Writes are performed by trusted server services.';
