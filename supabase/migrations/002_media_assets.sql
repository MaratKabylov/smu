create type public.media_asset_status as enum ('uploading', 'ready', 'failed');

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_ru text,
  alt_kk text,
  caption_ru text,
  caption_kk text,
  copyright_holder text,
  source_url text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  status public.media_asset_status not null default 'uploading',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (storage_bucket, storage_path)
);

create table public.media_usages (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  created_at timestamptz not null default now(),
  unique (media_asset_id, entity_type, entity_id, field_name)
);

create index media_assets_created_at_idx
  on public.media_assets(created_at desc)
  where deleted_at is null;
create index media_assets_mime_type_idx
  on public.media_assets(mime_type)
  where deleted_at is null;
create index media_usages_asset_idx on public.media_usages(media_asset_id);
create index media_usages_entity_idx
  on public.media_usages(entity_type, entity_id);

create trigger media_assets_set_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

insert into public.permissions (code, name)
values
  ('media.view', 'Просмотр медиа-библиотеки'),
  ('media.create', 'Загрузка медиафайлов'),
  ('media.edit', 'Редактирование метаданных медиафайлов'),
  ('media.delete', 'Мягкое удаление медиафайлов'),
  ('media.purge', 'Физическое удаление медиафайлов')
on conflict (code) do update set name = excluded.name;

with grants(role_code, permission_code) as (
  values
    ('author', 'media.view'),
    ('author', 'media.create'),
    ('editor', 'media.view'),
    ('editor', 'media.create'),
    ('editor', 'media.edit'),
    ('content_manager', 'media.view'),
    ('content_manager', 'media.create'),
    ('content_manager', 'media.edit'),
    ('content_manager', 'media.delete'),
    ('scientist_manager', 'media.view'),
    ('scientist_manager', 'media.create'),
    ('scientist_manager', 'media.edit'),
    ('project_manager', 'media.view'),
    ('project_manager', 'media.create'),
    ('project_manager', 'media.edit')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin'
  and p.code like 'media.%'
  and p.code <> 'media.purge'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and p.code like 'media.%'
on conflict do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('organization-logos', 'organization-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('article-media', 'article-media', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('research-files', 'research-files', false, 52428800, array['application/pdf', 'text/csv', 'application/zip']),
  ('publication-files', 'publication-files', false, 52428800, array['application/pdf']),
  ('event-media', 'event-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('documents', 'documents', false, 52428800, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('it-request-files', 'it-request-files', false, 52428800, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.media_assets enable row level security;
alter table public.media_usages enable row level security;

create policy "media_assets_read_public"
on public.media_assets for select
to anon, authenticated
using (
  status = 'ready'
  and deleted_at is null
  and storage_bucket in (
    'avatars',
    'organization-logos',
    'article-media',
    'event-media'
  )
);

create policy "media_assets_read_authorized"
on public.media_assets for select
to authenticated
using (public.has_permission('media.view'));

create policy "media_usages_read_authorized"
on public.media_usages for select
to authenticated
using (public.has_permission('media.view'));

create policy "media_objects_read_authorized"
on storage.objects for select
to authenticated
using (
  bucket_id in (
    'avatars',
    'organization-logos',
    'article-media',
    'research-files',
    'publication-files',
    'event-media',
    'documents',
    'it-request-files'
  )
  and public.has_permission('media.view')
);

comment on table public.media_assets is
  'Central media library metadata. Storage bytes are managed only through the Storage API.';
comment on table public.media_usages is
  'Explicit links showing where a media asset is used.';
