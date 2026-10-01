create type public.scientist_profile_status as enum ('draft', 'verified');

create table public.scientific_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name_ru text not null,
  name_kk text not null,
  city_ru text,
  city_kk text,
  website_url text,
  logo_media_id uuid references public.media_assets(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scientific_fields (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name_ru text not null,
  name_kk text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scientist_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  organization_id uuid references public.scientific_organizations(id) on delete set null,
  avatar_media_id uuid references public.media_assets(id) on delete set null,
  status public.scientist_profile_status not null default 'draft',
  public_email text,
  orcid text,
  scholar_url text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (status <> 'verified' or verified_at is not null),
  check (orcid is null or orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$')
);

create table public.scientist_profile_translations (
  id uuid primary key default gen_random_uuid(),
  scientist_profile_id uuid not null references public.scientist_profiles(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk')),
  full_name text not null,
  slug text not null check (slug = lower(slug)),
  position text not null,
  academic_degree text,
  short_bio text not null,
  biography text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scientist_profile_id, locale),
  unique (locale, slug)
);

create table public.scientist_field_links (
  scientist_profile_id uuid not null references public.scientist_profiles(id) on delete cascade,
  scientific_field_id uuid not null references public.scientific_fields(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (scientist_profile_id, scientific_field_id)
);

create index scientist_profiles_status_idx
  on public.scientist_profiles(status, updated_at desc)
  where deleted_at is null;
create index scientist_profiles_organization_idx
  on public.scientist_profiles(organization_id)
  where deleted_at is null;
create index scientist_translations_name_search_idx
  on public.scientist_profile_translations using gin (to_tsvector('simple', full_name));
create index scientist_field_links_field_idx
  on public.scientist_field_links(scientific_field_id);

create trigger scientific_organizations_set_updated_at
before update on public.scientific_organizations
for each row execute function public.set_updated_at();

create trigger scientific_fields_set_updated_at
before update on public.scientific_fields
for each row execute function public.set_updated_at();

create trigger scientist_profiles_set_updated_at
before update on public.scientist_profiles
for each row execute function public.set_updated_at();

create trigger scientist_profile_translations_set_updated_at
before update on public.scientist_profile_translations
for each row execute function public.set_updated_at();

create or replace function public.sync_scientist_avatar_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.media_usages
    where entity_type = 'scientist_profile'
      and entity_id = old.id
      and field_name = 'avatar';
    return old;
  end if;

  delete from public.media_usages
  where entity_type = 'scientist_profile'
    and entity_id = new.id
    and field_name = 'avatar';

  if new.avatar_media_id is not null and new.deleted_at is null then
    insert into public.media_usages (media_asset_id, entity_type, entity_id, field_name)
    values (new.avatar_media_id, 'scientist_profile', new.id, 'avatar')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_scientist_avatar_usage() from public;

create trigger scientist_profiles_sync_avatar_usage
after insert or update of avatar_media_id, deleted_at or delete on public.scientist_profiles
for each row execute function public.sync_scientist_avatar_usage();

alter table public.scientific_organizations enable row level security;
alter table public.scientific_fields enable row level security;
alter table public.scientist_profiles enable row level security;
alter table public.scientist_profile_translations enable row level security;
alter table public.scientist_field_links enable row level security;

create policy "scientific_organizations_read_active"
on public.scientific_organizations for select to anon, authenticated
using (is_active);

create policy "scientific_organizations_read_managers"
on public.scientific_organizations for select to authenticated
using (public.has_permission('scientists.edit'));

create policy "scientific_fields_read_active"
on public.scientific_fields for select to anon, authenticated
using (is_active);

create policy "scientific_fields_read_managers"
on public.scientific_fields for select to authenticated
using (public.has_permission('scientists.edit'));

create policy "scientist_profiles_read_verified"
on public.scientist_profiles for select to anon, authenticated
using (status = 'verified' and deleted_at is null);

create policy "scientist_profiles_read_managers"
on public.scientist_profiles for select to authenticated
using (deleted_at is null and public.has_permission('scientists.edit'));

create policy "scientist_translations_read_visible"
on public.scientist_profile_translations for select to anon, authenticated
using (exists (
  select 1 from public.scientist_profiles sp
  where sp.id = scientist_profile_id
));

create policy "scientist_field_links_read_visible"
on public.scientist_field_links for select to anon, authenticated
using (exists (
  select 1 from public.scientist_profiles sp
  where sp.id = scientist_profile_id
));

comment on table public.scientist_profiles is
  'Language-neutral scientist directory records with verification state.';
comment on table public.scientist_profile_translations is
  'Required Russian and Kazakh public scientist profile content.';
