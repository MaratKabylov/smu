create type public.mentorship_offer_status as enum ('draft', 'published', 'archived');
create type public.mentorship_application_status as enum ('new', 'in_review', 'accepted', 'rejected', 'completed');

create table public.mentorship_offers (
  id uuid primary key default gen_random_uuid(),
  scientist_id uuid not null references public.scientist_profiles(id) on delete restrict,
  field_id uuid not null references public.scientific_fields(id) on delete restrict,
  format text not null check (format in ('online', 'offline', 'hybrid')),
  capacity integer not null check (capacity between 1 and 50),
  status public.mentorship_offer_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.mentorship_offer_translations (
  offer_id uuid not null references public.mentorship_offers(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk')),
  title text not null check (length(btrim(title)) between 3 and 240),
  slug text not null check (length(slug) between 2 and 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary text not null check (length(btrim(summary)) between 20 and 800),
  description text not null check (length(btrim(description)) between 40 and 20000),
  primary key (offer_id, locale),
  unique (locale, slug)
);
create table public.mentorship_applications (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.mentorship_offers(id) on delete restrict,
  locale text not null check (locale in ('ru', 'kk')),
  full_name text not null check (length(btrim(full_name)) between 2 and 160),
  email text not null check (length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  motivation text not null check (length(btrim(motivation)) between 40 and 5000),
  consent_at timestamptz not null default now(),
  status public.mentorship_application_status not null default 'new',
  manager_note text not null default '' check (length(manager_note) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index mentorship_offers_catalog_idx on public.mentorship_offers(status, field_id, updated_at desc) where deleted_at is null;
create index mentorship_applications_queue_idx on public.mentorship_applications(offer_id, status, created_at desc) where deleted_at is null;
create index mentorship_applications_rate_idx on public.mentorship_applications(email, created_at desc);
create unique index mentorship_applications_active_email_idx on public.mentorship_applications(offer_id, email)
  where deleted_at is null and status in ('new', 'in_review', 'accepted');
create trigger mentorship_offers_updated before update on public.mentorship_offers for each row execute function public.set_updated_at();
create trigger mentorship_applications_updated before update on public.mentorship_applications for each row execute function public.set_updated_at();

alter table public.mentorship_offers enable row level security;
alter table public.mentorship_offer_translations enable row level security;
alter table public.mentorship_applications enable row level security;
create policy mentorship_offers_public on public.mentorship_offers for select to anon, authenticated
  using (status = 'published' and deleted_at is null
    and exists (select 1 from public.scientist_profiles s where s.id = scientist_id and s.status = 'verified' and s.deleted_at is null)
    and exists (select 1 from public.scientific_fields f where f.id = field_id and f.is_active));
create policy mentorship_offers_manager on public.mentorship_offers for select to authenticated
  using (deleted_at is null and public.has_permission('mentorship.manage'));
create policy mentorship_translations_visible on public.mentorship_offer_translations for select to anon, authenticated
  using (exists (select 1 from public.mentorship_offers o where o.id = offer_id));
create policy mentorship_applications_manager on public.mentorship_applications for select to authenticated
  using (deleted_at is null and public.has_permission('mentorship.manage'));
grant select on public.mentorship_offers, public.mentorship_offer_translations to anon, authenticated;
-- Personal data is never readable by anonymous visitors, including under Supabase default grants.
revoke all on public.mentorship_applications from anon;
grant select on public.mentorship_applications to authenticated;

create function public.save_mentorship_offer(p_id uuid, p_actor uuid, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_locale text; v_t jsonb; v_old public.mentorship_offers%rowtype;
begin
  if not exists (select 1 from public.scientist_profiles where id = (p_input->>'scientistId')::uuid and status = 'verified' and deleted_at is null)
    or not exists (select 1 from public.scientific_fields where id = (p_input->>'fieldId')::uuid and is_active)
  then raise exception 'invalid_reference'; end if;
  if p_id is null then
    insert into public.mentorship_offers(scientist_id, field_id, format, capacity, created_by)
      values ((p_input->>'scientistId')::uuid, (p_input->>'fieldId')::uuid, p_input->>'format', (p_input->>'capacity')::integer, p_actor)
      returning id into v_id;
  else
    select * into v_old from public.mentorship_offers where id = p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    if (p_input->>'capacity')::integer < (select count(*) from public.mentorship_applications where offer_id = p_id and status = 'accepted' and deleted_at is null)
      then raise exception 'capacity_exceeded'; end if;
    if (p_input->>'scientistId')::uuid <> v_old.scientist_id and exists (select 1 from public.mentorship_applications where offer_id = p_id and status in ('new', 'in_review', 'accepted') and deleted_at is null)
      then raise exception 'mentor_has_applications'; end if;
    v_id := p_id;
    update public.mentorship_offers set scientist_id = (p_input->>'scientistId')::uuid, field_id = (p_input->>'fieldId')::uuid,
      format = p_input->>'format', capacity = (p_input->>'capacity')::integer, status = 'draft' where id = v_id;
  end if;
  foreach v_locale in array array['ru', 'kk'] loop
    v_t := p_input->v_locale;
    insert into public.mentorship_offer_translations(offer_id, locale, title, slug, summary, description)
      values (v_id, v_locale, v_t->>'title', v_t->>'slug', v_t->>'summary', v_t->>'description')
      on conflict (offer_id, locale) do update set title = excluded.title, slug = excluded.slug, summary = excluded.summary, description = excluded.description;
  end loop;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'mentorship_offer', v_id, case when p_id is null then 'mentorship.create' else 'mentorship.update' end,
      case when p_id is null then null else to_jsonb(v_old) end, p_input);
  return v_id;
end;
$$;

create function public.change_mentorship_offer_state(p_id uuid, p_actor uuid, p_status public.mentorship_offer_status, p_delete boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_old public.mentorship_offers%rowtype;
begin
  select * into v_old from public.mentorship_offers where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_delete then
    if exists (select 1 from public.mentorship_applications where offer_id = p_id and status in ('new', 'in_review', 'accepted') and deleted_at is null)
      then raise exception 'mentor_has_applications'; end if;
    update public.mentorship_offers set deleted_at = now() where id = p_id;
    update public.mentorship_applications set deleted_at = now() where offer_id = p_id and deleted_at is null;
  else
    if p_status is null or p_status = v_old.status or (v_old.status = 'archived' and p_status <> 'draft') then raise exception 'invalid_transition'; end if;
    if p_status = 'published' and (
      (select count(*) from public.mentorship_offer_translations where offer_id = p_id) <> 2
      or not exists (select 1 from public.scientist_profiles where id = v_old.scientist_id and status = 'verified' and deleted_at is null)
      or not exists (select 1 from public.scientific_fields where id = v_old.field_id and is_active)
      or (select count(*) from public.scientist_profile_translations where scientist_profile_id = v_old.scientist_id) <> 2
    ) then raise exception 'invalid_reference'; end if;
    update public.mentorship_offers set status = p_status where id = p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'mentorship_offer', p_id, case when p_delete then 'mentorship.soft_delete' else 'mentorship.status.change' end,
      jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status, 'deleted', p_delete));
end;
$$;

-- Only the server calls this RPC after validation. Serializing each email prevents concurrent rate-limit bypass.
create function public.submit_mentorship_application(p_offer uuid, p_input jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_offer public.mentorship_offers%rowtype; v_email text := lower(btrim(p_input->>'email')); v_id uuid;
begin
  if (p_input->>'consent')::boolean is distinct from true then raise exception 'consent_required'; end if;
  if v_email is null then raise exception 'invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  select * into v_offer from public.mentorship_offers where id = p_offer and status = 'published' and deleted_at is null for update;
  if not found then raise exception 'not_available'; end if;
  if not exists (select 1 from public.scientist_profiles where id = v_offer.scientist_id and status = 'verified' and deleted_at is null)
    or not exists (select 1 from public.scientific_fields where id = v_offer.field_id and is_active)
    then raise exception 'not_available'; end if;
  if (select count(*) from public.mentorship_applications where email = v_email and created_at > now() - interval '24 hours') >= 3
    then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.mentorship_applications where offer_id = p_offer and email = v_email and status in ('new', 'in_review', 'accepted') and deleted_at is null)
    then raise exception 'duplicate_application'; end if;
  if (select count(*) from public.mentorship_applications where offer_id = p_offer and status = 'accepted' and deleted_at is null) >= v_offer.capacity
    then raise exception 'capacity_exceeded'; end if;
  insert into public.mentorship_applications(offer_id, locale, full_name, email, motivation)
    values (p_offer, p_input->>'locale', btrim(p_input->>'fullName'), v_email, btrim(p_input->>'motivation')) returning id into v_id;
  -- Audit records carry IDs and status, never applicant contact details or motivation.
  insert into public.audit_logs(entity_type, entity_id, action, new_data)
    values ('mentorship_application', v_id, 'mentorship.application.create', jsonb_build_object('offerId', p_offer, 'status', 'new'));
end;
$$;

create function public.update_mentorship_application(p_id uuid, p_actor uuid, p_status public.mentorship_application_status, p_note text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_old public.mentorship_applications%rowtype; v_offer public.mentorship_offers%rowtype; v_offer_id uuid;
begin
  select offer_id into v_offer_id from public.mentorship_applications where id = p_id and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  -- Use the same offer-first lock order as submission and capacity changes.
  select * into v_offer from public.mentorship_offers where id = v_offer_id for update;
  select * into v_old from public.mentorship_applications where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_status is null or not (p_status = v_old.status
    or (v_old.status = 'new' and p_status in ('in_review', 'rejected'))
    or (v_old.status = 'in_review' and p_status in ('accepted', 'rejected'))
    or (v_old.status = 'accepted' and p_status = 'completed')) then raise exception 'invalid_transition'; end if;
  if p_status = 'accepted' and v_old.status <> 'accepted' then
    if v_offer.status <> 'published' or v_offer.deleted_at is not null
      or not exists (select 1 from public.scientist_profiles where id = v_offer.scientist_id and status = 'verified' and deleted_at is null)
      or not exists (select 1 from public.scientific_fields where id = v_offer.field_id and is_active)
      then raise exception 'not_available'; end if;
    if (select count(*) from public.mentorship_applications where offer_id = v_old.offer_id and status = 'accepted' and deleted_at is null) >= v_offer.capacity
      then raise exception 'capacity_exceeded'; end if;
  end if;
  update public.mentorship_applications set status = p_status, manager_note = p_note where id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'mentorship_application', p_id, 'mentorship.application.update',
      jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.save_mentorship_offer(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.change_mentorship_offer_state(uuid, uuid, public.mentorship_offer_status, boolean) from public, anon, authenticated;
revoke all on function public.submit_mentorship_application(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_mentorship_application(uuid, uuid, public.mentorship_application_status, text) from public, anon, authenticated;
grant execute on function public.save_mentorship_offer(uuid, uuid, jsonb) to service_role;
grant execute on function public.change_mentorship_offer_state(uuid, uuid, public.mentorship_offer_status, boolean) to service_role;
grant execute on function public.submit_mentorship_application(uuid, jsonb) to service_role;
grant execute on function public.update_mentorship_application(uuid, uuid, public.mentorship_application_status, text) to service_role;
