create type public.event_status as enum ('draft', 'published', 'cancelled', 'archived');
create type public.event_format as enum ('offline', 'online', 'hybrid');
create type public.event_kind as enum ('conference', 'seminar', 'workshop', 'meetup');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  status public.event_status not null default 'draft',
  kind public.event_kind not null,
  format public.event_format not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_deadline timestamptz,
  registration_url text check (registration_url is null or (length(registration_url) <= 1000 and registration_url ~* '^https?://')),
  external_url text check (external_url is null or (length(external_url) <= 1000 and external_url ~* '^https?://')),
  cover_media_id uuid references public.media_assets(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at),
  check (registration_deadline is null or (registration_deadline <= starts_at and registration_url is not null)),
  check (format = 'offline' or external_url is not null),
  check (status not in ('published', 'cancelled') or published_at is not null)
);
create table public.event_translations (
  event_id uuid not null references public.events(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk')),
  title text not null check (length(trim(title)) between 3 and 240),
  slug text not null check (length(slug) between 2 and 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary text not null check (length(trim(summary)) between 20 and 800),
  description text not null check (length(trim(description)) between 40 and 30000),
  organizer text not null check (length(trim(organizer)) between 2 and 240),
  location text not null default '' check (length(location) <= 500),
  primary key (event_id, locale),
  unique (locale, slug)
);
create index events_catalog_idx on public.events(status, starts_at) where deleted_at is null;
create index events_period_idx on public.events(ends_at) where deleted_at is null;
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.event_translations enable row level security;
create policy "events_read_public" on public.events for select to anon, authenticated
  using (status in ('published', 'cancelled') and deleted_at is null);
create policy "events_read_managers" on public.events for select to authenticated
  using (deleted_at is null and public.has_permission('events.manage'));
create policy "event_translations_read_visible" on public.event_translations for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
grant select on public.events, public.event_translations to anon, authenticated;

insert into public.permissions(code, name) values ('events.manage', 'Управление событиями')
  on conflict (code) do update set name = excluded.name;
insert into public.role_permissions(role_id, permission_id)
  select r.id, p.id from public.roles r cross join public.permissions p
  where r.code in ('admin', 'super_admin') and p.code = 'events.manage' on conflict do nothing;

create function public.sync_event_cover_usage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.media_usages where entity_type = 'event' and entity_id = old.id and field_name = 'cover';
    return old;
  end if;
  delete from public.media_usages where entity_type = 'event' and entity_id = new.id and field_name = 'cover';
  if new.cover_media_id is not null and new.deleted_at is null then
    insert into public.media_usages(media_asset_id, entity_type, entity_id, field_name)
      values (new.cover_media_id, 'event', new.id, 'cover') on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_event_cover_usage() from public;
create trigger events_sync_cover_usage after insert or update of cover_media_id, deleted_at or delete on public.events
  for each row execute function public.sync_event_cover_usage();

-- Only the server service role may mutate events, after session RBAC.
-- Both translations, cover usage, draft reset and audit share one transaction.
create function public.save_event(p_id uuid, p_actor uuid, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_old public.events%rowtype;
  v_locale text;
  v_translation jsonb;
  v_cover uuid := nullif(p_input->>'coverMediaId', '')::uuid;
begin
  if v_cover is not null and not exists (select 1 from public.media_assets where id = v_cover
    and status = 'ready' and deleted_at is null and storage_bucket in ('article-media', 'event-media') and mime_type like 'image/%')
  then raise exception 'invalid_reference'; end if;
  if p_id is not null then
    select * into v_old from public.events where id = p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    v_id := p_id;
    update public.events set status = 'draft', published_at = null,
      kind = (p_input->>'kind')::public.event_kind, format = (p_input->>'format')::public.event_format,
      starts_at = (p_input->>'startsAt')::timestamptz, ends_at = (p_input->>'endsAt')::timestamptz,
      registration_deadline = nullif(p_input->>'registrationDeadline', '')::timestamptz,
      registration_url = nullif(p_input->>'registrationUrl', ''), external_url = nullif(p_input->>'externalUrl', ''),
      cover_media_id = v_cover where id = v_id;
  else
    insert into public.events(kind, format, starts_at, ends_at, registration_deadline, registration_url, external_url, cover_media_id, created_by)
      values ((p_input->>'kind')::public.event_kind, (p_input->>'format')::public.event_format,
        (p_input->>'startsAt')::timestamptz, (p_input->>'endsAt')::timestamptz,
        nullif(p_input->>'registrationDeadline', '')::timestamptz, nullif(p_input->>'registrationUrl', ''),
        nullif(p_input->>'externalUrl', ''), v_cover, p_actor) returning id into v_id;
  end if;
  foreach v_locale in array array['ru', 'kk'] loop
    v_translation := p_input->v_locale;
    if (p_input->>'format') <> 'online' and coalesce(length(trim(v_translation->>'location')), 0) < 3
      then raise exception 'invalid_location'; end if;
    insert into public.event_translations(event_id, locale, title, slug, summary, description, organizer, location)
      values (v_id, v_locale, v_translation->>'title', v_translation->>'slug', v_translation->>'summary',
        v_translation->>'description', v_translation->>'organizer', v_translation->>'location')
      on conflict (event_id, locale) do update set title = excluded.title, slug = excluded.slug,
        summary = excluded.summary, description = excluded.description, organizer = excluded.organizer, location = excluded.location;
  end loop;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'event', v_id, case when p_id is null then 'event.create' else 'event.update' end,
      case when p_id is null then null else to_jsonb(v_old) end, p_input);
  return v_id;
end;
$$;
revoke all on function public.save_event(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_event(uuid, uuid, jsonb) to service_role;

create function public.change_event_state(p_id uuid, p_actor uuid, p_status public.event_status, p_delete boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_old public.events%rowtype;
begin
  select * into v_old from public.events where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_delete then
    update public.events set deleted_at = now() where id = p_id;
  else
    if p_status is null or p_status = v_old.status or (v_old.status = 'archived' and p_status <> 'draft')
      or (p_status = 'cancelled' and v_old.status <> 'published')
      then raise exception 'invalid_transition'; end if;
    if p_status in ('published', 'cancelled') then
      if (select count(*) from public.event_translations where event_id = p_id) <> 2
        or (v_old.format <> 'online' and exists (select 1 from public.event_translations where event_id = p_id and length(trim(location)) < 3))
        or (v_old.cover_media_id is not null and not exists (select 1 from public.media_assets where id = v_old.cover_media_id
          and status = 'ready' and deleted_at is null and storage_bucket in ('article-media', 'event-media') and mime_type like 'image/%'))
        then raise exception 'invalid_reference'; end if;
    end if;
    update public.events set status = p_status,
      published_at = case when p_status in ('published', 'cancelled') then coalesce(v_old.published_at, now()) else null end where id = p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'event', p_id, case when p_delete then 'event.soft_delete' else 'event.status.change' end,
      jsonb_build_object('status', v_old.status),
      case when p_delete then jsonb_build_object('deletedAt', now()) else jsonb_build_object('status', p_status) end);
end;
$$;
revoke all on function public.change_event_state(uuid, uuid, public.event_status, boolean) from public, anon, authenticated;
grant execute on function public.change_event_state(uuid, uuid, public.event_status, boolean) to service_role;
