-- Research and projects share content structure, but retain separate permissions.
create type public.science_work_kind as enum ('research', 'project');
create type public.science_work_status as enum ('draft', 'published', 'archived');
create type public.science_work_stage as enum ('planned', 'active', 'completed');

create table public.science_works (
  id uuid primary key default gen_random_uuid(),
  kind public.science_work_kind not null,
  status public.science_work_status not null default 'draft',
  stage public.science_work_stage not null default 'planned',
  organization_id uuid references public.scientific_organizations(id) on delete restrict,
  field_id uuid not null references public.scientific_fields(id) on delete restrict,
  cover_media_id uuid references public.media_assets(id) on delete restrict,
  start_date date,
  end_date date,
  external_url text check (external_url is null or external_url ~* '^https?://'),
  doi text check (doi is null or doi ~ '^10\.\d{4,9}/\S+$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (start_date is null or end_date is null or end_date >= start_date),
  check (status <> 'published' or published_at is not null)
);
create table public.science_work_translations (
  work_id uuid not null references public.science_works(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk')),
  title text not null check (length(trim(title)) between 3 and 240),
  slug text not null check (length(slug) between 2 and 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary text not null check (length(trim(summary)) between 20 and 800),
  description text not null check (length(trim(description)) between 40 and 30000),
  results text not null default '' check (length(results) <= 20000),
  primary key (work_id, locale),
  unique (locale, slug)
);
create table public.science_work_members (
  work_id uuid not null references public.science_works(id) on delete cascade,
  scientist_id uuid not null references public.scientist_profiles(id) on delete restrict,
  role text not null check (role in ('lead', 'member')),
  primary key (work_id, scientist_id)
);
create unique index science_work_one_lead_idx on public.science_work_members(work_id) where role = 'lead';
create index science_works_catalog_idx on public.science_works(kind, status, updated_at desc) where deleted_at is null;
create index science_works_field_idx on public.science_works(field_id) where deleted_at is null;
create index science_works_organization_idx on public.science_works(organization_id) where deleted_at is null;
create index science_work_members_scientist_idx on public.science_work_members(scientist_id);
create trigger science_works_set_updated_at before update on public.science_works
for each row execute function public.set_updated_at();

alter table public.science_works enable row level security;
alter table public.science_work_translations enable row level security;
alter table public.science_work_members enable row level security;
create policy "science_works_read_published" on public.science_works for select to anon, authenticated
using (status = 'published' and deleted_at is null);
create policy "science_works_read_managers" on public.science_works for select to authenticated
using (deleted_at is null and public.has_permission(case when kind = 'project' then 'projects.manage' else 'research.manage' end));
create policy "science_work_translations_read_visible" on public.science_work_translations for select to anon, authenticated
using (exists (select 1 from public.science_works w where w.id = work_id));
create policy "science_work_members_read_visible" on public.science_work_members for select to anon, authenticated
using (exists (select 1 from public.science_works w where w.id = work_id)
  and exists (select 1 from public.scientist_profiles s where s.id = scientist_id and s.status = 'verified' and s.deleted_at is null));
create policy "science_work_members_read_managers" on public.science_work_members for select to authenticated
using (exists (select 1 from public.science_works w where w.id = work_id
  and public.has_permission(case when w.kind = 'project' then 'projects.manage' else 'research.manage' end)));
grant select on public.science_works, public.science_work_translations, public.science_work_members to anon, authenticated;

create function public.sync_science_work_cover_usage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.media_usages where entity_type = 'science_work' and entity_id = old.id and field_name = 'cover';
    return old;
  end if;
  delete from public.media_usages where entity_type = 'science_work' and entity_id = new.id and field_name = 'cover';
  if new.cover_media_id is not null and new.deleted_at is null then
    insert into public.media_usages(media_asset_id, entity_type, entity_id, field_name)
    values (new.cover_media_id, 'science_work', new.id, 'cover') on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_science_work_cover_usage() from public;
create trigger science_works_sync_cover_usage
  after insert or update of cover_media_id, deleted_at or delete on public.science_works
  for each row execute function public.sync_science_work_cover_usage();

-- Callable only by the server after session-based RBAC. Content, relations,
-- draft reset and audit are committed together or rolled back together.
create function public.save_science_work(p_id uuid, p_kind public.science_work_kind, p_actor uuid, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_old public.science_works%rowtype;
  v_locale text;
  v_translation jsonb;
  v_field uuid := (p_input->>'fieldId')::uuid;
  v_org uuid := nullif(p_input->>'organizationId', '')::uuid;
  v_cover uuid := nullif(p_input->>'coverMediaId', '')::uuid;
  v_lead uuid := nullif(p_input->>'leadScientistId', '')::uuid;
begin
  if not exists (select 1 from public.scientific_fields where id = v_field and is_active)
    or (v_org is not null and not exists (select 1 from public.scientific_organizations where id = v_org and is_active))
    or (v_cover is not null and not exists (select 1 from public.media_assets where id = v_cover
      and status = 'ready' and deleted_at is null and storage_bucket = 'article-media' and mime_type like 'image/%'))
    or (v_lead is not null and not exists (select 1 from public.scientist_profiles where id = v_lead and status = 'verified' and deleted_at is null))
    or exists (select 1 from jsonb_array_elements_text(p_input->'memberIds') m
      where not exists (select 1 from public.scientist_profiles s where s.id = m.value::uuid and s.status = 'verified' and s.deleted_at is null))
  then raise exception 'invalid_reference'; end if;

  if p_id is null then
    insert into public.science_works(kind, field_id, created_by) values (p_kind, v_field, p_actor) returning id into v_id;
  else
    select * into v_old from public.science_works where id = p_id and kind = p_kind and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    v_id := p_id;
  end if;
  update public.science_works set
    status = 'draft', published_at = null,
    stage = (p_input->>'stage')::public.science_work_stage,
    organization_id = v_org, field_id = v_field, cover_media_id = v_cover,
    start_date = nullif(p_input->>'startDate', '')::date,
    end_date = nullif(p_input->>'endDate', '')::date,
    external_url = nullif(p_input->>'externalUrl', ''), doi = nullif(p_input->>'doi', '')
  where id = v_id;
  foreach v_locale in array array['ru', 'kk'] loop
    v_translation := p_input->v_locale;
    insert into public.science_work_translations(work_id, locale, title, slug, summary, description, results)
    values (v_id, v_locale, v_translation->>'title', v_translation->>'slug', v_translation->>'summary',
      v_translation->>'description', v_translation->>'results')
    on conflict (work_id, locale) do update set
      title = excluded.title, slug = excluded.slug, summary = excluded.summary,
      description = excluded.description, results = excluded.results;
  end loop;
  delete from public.science_work_members where work_id = v_id;
  if v_lead is not null then
    insert into public.science_work_members(work_id, scientist_id, role) values (v_id, v_lead, 'lead');
  end if;
  insert into public.science_work_members(work_id, scientist_id, role)
    select v_id, value::uuid, 'member' from jsonb_array_elements_text(p_input->'memberIds');
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'science_work', v_id, p_kind::text || case when p_id is null then '.create' else '.update' end,
      case when p_id is null then null else to_jsonb(v_old) end, p_input);
  return v_id;
end;
$$;
revoke all on function public.save_science_work(uuid, public.science_work_kind, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_science_work(uuid, public.science_work_kind, uuid, jsonb) to service_role;

create function public.change_science_work_state(p_id uuid, p_kind public.science_work_kind, p_actor uuid, p_status public.science_work_status, p_delete boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_old public.science_works%rowtype;
begin
  select * into v_old from public.science_works where id = p_id and kind = p_kind and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_delete then
    update public.science_works set deleted_at = now() where id = p_id;
  else
    if p_status is null or p_status = v_old.status or (v_old.status = 'archived' and p_status <> 'draft') then
      raise exception 'invalid_transition';
    end if;
    if p_status = 'published' then
      if (select count(*) from public.science_work_translations where work_id = p_id) <> 2
        or exists (select 1 from public.science_work_members m join public.scientist_profiles s on s.id = m.scientist_id
          where m.work_id = p_id and (s.status <> 'verified' or s.deleted_at is not null))
        or not exists (select 1 from public.scientific_fields where id = v_old.field_id and is_active)
        or (v_old.organization_id is not null and not exists (select 1 from public.scientific_organizations where id = v_old.organization_id and is_active))
        or (v_old.cover_media_id is not null and not exists (select 1 from public.media_assets where id = v_old.cover_media_id
          and status = 'ready' and deleted_at is null and storage_bucket = 'article-media' and mime_type like 'image/%'))
      then raise exception 'invalid_reference'; end if;
    end if;
    update public.science_works set status = p_status,
      published_at = case when p_status = 'published' then now() else null end where id = p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'science_work', p_id, p_kind::text || case when p_delete then '.soft_delete' else '.status.change' end,
      jsonb_build_object('status', v_old.status),
      case when p_delete then jsonb_build_object('deletedAt', now()) else jsonb_build_object('status', p_status) end);
end;
$$;
revoke all on function public.change_science_work_state(uuid, public.science_work_kind, uuid, public.science_work_status, boolean) from public, anon, authenticated;
grant execute on function public.change_science_work_state(uuid, public.science_work_kind, uuid, public.science_work_status, boolean) to service_role;
