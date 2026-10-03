create type public.research_program_status as enum ('draft', 'published', 'archived');
create type public.research_program_application_status as enum ('new', 'in_review', 'accepted', 'rejected', 'completed');

insert into public.permissions(code, name) values ('research_program.manage', 'Управление исследовательскими программами')
  on conflict (code) do update set name = excluded.name;
insert into public.role_permissions(role_id, permission_id)
  select r.id, p.id from public.roles r cross join public.permissions p
  where r.code in ('admin', 'super_admin') and p.code = 'research_program.manage' on conflict do nothing;

create table public.research_programs (
  id uuid primary key default gen_random_uuid(),
  coordinator_id uuid not null references public.scientist_profiles(id) on delete restrict,
  field_id uuid not null references public.scientific_fields(id) on delete restrict,
  format text not null check (format in ('online', 'offline', 'hybrid')),
  capacity integer not null check (capacity between 1 and 500),
  applications_open_on date not null,
  application_deadline date not null,
  starts_on date not null,
  ends_on date not null,
  check (applications_open_on <= application_deadline and application_deadline <= starts_on and starts_on <= ends_on),
  status public.research_program_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.research_program_translations (
  program_id uuid not null references public.research_programs(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk')),
  title text not null check (length(btrim(title)) between 3 and 240),
  slug text not null check (length(slug) between 2 and 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary text not null check (length(btrim(summary)) between 20 and 800),
  description text not null check (length(btrim(description)) between 40 and 20000),
  curriculum text not null check (length(btrim(curriculum)) between 20 and 10000),
  eligibility text not null check (length(btrim(eligibility)) between 20 and 5000),
  outcomes text not null check (length(btrim(outcomes)) between 20 and 10000),
  primary key (program_id, locale), unique (locale, slug)
);
create table public.research_program_applications (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.research_programs(id) on delete restrict,
  locale text not null check (locale in ('ru', 'kk')),
  full_name text not null check (length(btrim(full_name)) between 2 and 160),
  email text not null check (length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  motivation text not null check (length(btrim(motivation)) between 40 and 5000),
  consent_at timestamptz not null default now(),
  status public.research_program_application_status not null default 'new',
  manager_note text not null default '' check (length(manager_note) <= 5000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index research_programs_catalog_idx on public.research_programs(status, field_id, updated_at desc) where deleted_at is null;
create index research_program_applications_queue_idx on public.research_program_applications(program_id, status, created_at desc) where deleted_at is null;
create index research_program_applications_rate_idx on public.research_program_applications(email, created_at desc);
create unique index research_program_applications_email_idx on public.research_program_applications(program_id, email)
  where deleted_at is null and status in ('new', 'in_review', 'accepted', 'completed');
create trigger research_programs_updated before update on public.research_programs for each row execute function public.set_updated_at();
create trigger research_program_applications_updated before update on public.research_program_applications for each row execute function public.set_updated_at();

alter table public.research_programs enable row level security;
alter table public.research_program_translations enable row level security;
alter table public.research_program_applications enable row level security;
create policy research_programs_public on public.research_programs for select to anon, authenticated
  using (status = 'published' and deleted_at is null
    and exists (select 1 from public.scientist_profiles s where s.id = coordinator_id and s.status = 'verified' and s.deleted_at is null)
    and exists (select 1 from public.scientific_fields f where f.id = field_id and f.is_active));
create policy research_programs_manager on public.research_programs for select to authenticated
  using (deleted_at is null and public.has_permission('research_program.manage'));
create policy research_program_translations_visible on public.research_program_translations for select to anon, authenticated
  using (exists (select 1 from public.research_programs p where p.id = program_id));
create policy research_program_applications_manager on public.research_program_applications for select to authenticated
  using (deleted_at is null and public.has_permission('research_program.manage'));
-- Revoke default Supabase table grants as well as PostgreSQL's public role.
revoke all on public.research_programs, public.research_program_translations, public.research_program_applications from public, anon, authenticated;
grant select on public.research_programs, public.research_program_translations to anon, authenticated;
grant select on public.research_program_applications to authenticated;
grant all on public.research_programs, public.research_program_translations, public.research_program_applications to service_role;

create function public.save_research_program(p_id uuid, p_actor uuid, p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_locale text; v_t jsonb; v_old public.research_programs%rowtype;
begin
  if not exists (select 1 from public.scientist_profiles where id = (p_input->>'coordinatorId')::uuid and status = 'verified' and deleted_at is null)
    or not exists (select 1 from public.scientific_fields where id = (p_input->>'fieldId')::uuid and is_active)
    then raise exception 'invalid_reference'; end if;
  if p_id is null then
    insert into public.research_programs(coordinator_id, field_id, format, capacity, applications_open_on, application_deadline, starts_on, ends_on, created_by)
      values ((p_input->>'coordinatorId')::uuid, (p_input->>'fieldId')::uuid, p_input->>'format', (p_input->>'capacity')::integer,
        (p_input->>'applicationsOpenOn')::date, (p_input->>'applicationDeadline')::date, (p_input->>'startsOn')::date, (p_input->>'endsOn')::date, p_actor)
      returning id into v_id;
  else
    select * into v_old from public.research_programs where id = p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    if (p_input->>'capacity')::integer < (select count(*) from public.research_program_applications where program_id = p_id and status in ('accepted', 'completed') and deleted_at is null)
      then raise exception 'capacity_exceeded'; end if;
    if (p_input->>'coordinatorId')::uuid <> v_old.coordinator_id and exists (select 1 from public.research_program_applications where program_id = p_id and status in ('new', 'in_review', 'accepted') and deleted_at is null)
      then raise exception 'program_has_applications'; end if;
    v_id := p_id;
    update public.research_programs set coordinator_id = (p_input->>'coordinatorId')::uuid, field_id = (p_input->>'fieldId')::uuid,
      format = p_input->>'format', capacity = (p_input->>'capacity')::integer,
      applications_open_on = (p_input->>'applicationsOpenOn')::date, application_deadline = (p_input->>'applicationDeadline')::date,
      starts_on = (p_input->>'startsOn')::date, ends_on = (p_input->>'endsOn')::date, status = 'draft' where id = v_id;
  end if;
  foreach v_locale in array array['ru', 'kk'] loop
    v_t := p_input->v_locale;
    insert into public.research_program_translations(program_id, locale, title, slug, summary, description, curriculum, eligibility, outcomes)
      values (v_id, v_locale, v_t->>'title', v_t->>'slug', v_t->>'summary', v_t->>'description', v_t->>'curriculum', v_t->>'eligibility', v_t->>'outcomes')
      on conflict (program_id, locale) do update set title = excluded.title, slug = excluded.slug, summary = excluded.summary,
        description = excluded.description, curriculum = excluded.curriculum, eligibility = excluded.eligibility, outcomes = excluded.outcomes;
  end loop;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'research_program', v_id, case when p_id is null then 'research_program.create' else 'research_program.update' end,
      case when p_id is null then null else to_jsonb(v_old) end, p_input);
  return v_id;
end;
$$;

create function public.change_research_program_state(p_id uuid, p_actor uuid, p_status public.research_program_status, p_delete boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_old public.research_programs%rowtype;
begin
  select * into v_old from public.research_programs where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_delete then
    if exists (select 1 from public.research_program_applications where program_id = p_id and status in ('new', 'in_review', 'accepted') and deleted_at is null)
      then raise exception 'program_has_applications'; end if;
    update public.research_programs set deleted_at = now() where id = p_id;
    update public.research_program_applications set deleted_at = now() where program_id = p_id and deleted_at is null;
  else
    if p_status is null or p_status = v_old.status or (v_old.status = 'archived' and p_status <> 'draft') then raise exception 'invalid_transition'; end if;
    if p_status = 'published' and (
      (select count(*) from public.research_program_translations where program_id = p_id) <> 2
      or not exists (select 1 from public.scientist_profiles where id = v_old.coordinator_id and status = 'verified' and deleted_at is null)
      or not exists (select 1 from public.scientific_fields where id = v_old.field_id and is_active)
      or (select count(*) from public.scientist_profile_translations where scientist_profile_id = v_old.coordinator_id) <> 2
    ) then raise exception 'invalid_reference'; end if;
    update public.research_programs set status = p_status where id = p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'research_program', p_id, case when p_delete then 'research_program.soft_delete' else 'research_program.status.change' end,
      jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status, 'deleted', p_delete));
end;
$$;

create function public.submit_research_program_application(p_program uuid, p_input jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_program public.research_programs%rowtype; v_email text := lower(btrim(p_input->>'email')); v_id uuid;
  v_today date := (now() at time zone 'Asia/Almaty')::date;
begin
  if (p_input->>'consent')::boolean is distinct from true then raise exception 'consent_required'; end if;
  if v_email is null then raise exception 'invalid_input'; end if;
  -- One lock per email prevents parallel submissions bypassing the daily limit.
  perform pg_advisory_xact_lock(hashtextextended('research_program:' || v_email, 0));
  select * into v_program from public.research_programs where id = p_program and status = 'published' and deleted_at is null for update;
  if not found then raise exception 'not_available'; end if;
  if not exists (select 1 from public.scientist_profiles where id = v_program.coordinator_id and status = 'verified' and deleted_at is null)
    or not exists (select 1 from public.scientific_fields where id = v_program.field_id and is_active)
    then raise exception 'not_available'; end if;
  if v_today < v_program.applications_open_on or v_today > v_program.application_deadline then raise exception 'applications_closed'; end if;
  if (select count(*) from public.research_program_applications where email = v_email and created_at > now() - interval '24 hours') >= 3
    then raise exception 'rate_limited'; end if;
  if exists (select 1 from public.research_program_applications where program_id = p_program and email = v_email and status in ('new', 'in_review', 'accepted', 'completed') and deleted_at is null)
    then raise exception 'duplicate_application'; end if;
  if (select count(*) from public.research_program_applications where program_id = p_program and status in ('accepted', 'completed') and deleted_at is null) >= v_program.capacity
    then raise exception 'capacity_exceeded'; end if;
  insert into public.research_program_applications(program_id, locale, full_name, email, motivation)
    values (p_program, p_input->>'locale', btrim(p_input->>'fullName'), v_email, btrim(p_input->>'motivation')) returning id into v_id;
  insert into public.audit_logs(entity_type, entity_id, action, new_data)
    values ('research_program_application', v_id, 'research_program.application.create', jsonb_build_object('programId', p_program, 'status', 'new'));
end;
$$;

create function public.update_research_program_application(p_id uuid, p_actor uuid, p_status public.research_program_application_status, p_note text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_old public.research_program_applications%rowtype; v_program public.research_programs%rowtype; v_program_id uuid;
begin
  select program_id into v_program_id from public.research_program_applications where id = p_id and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  -- All mutations acquire the program lock before the application lock.
  select * into v_program from public.research_programs where id = v_program_id for update;
  select * into v_old from public.research_program_applications where id = p_id and deleted_at is null for update;
  if not found or v_program.deleted_at is not null then raise exception 'not_found'; end if;
  if p_status is null or not (p_status = v_old.status
    or (v_old.status = 'new' and p_status in ('in_review', 'rejected'))
    or (v_old.status = 'in_review' and p_status in ('accepted', 'rejected'))
    or (v_old.status = 'accepted' and p_status = 'completed')) then raise exception 'invalid_transition'; end if;
  if p_status = 'accepted' and v_old.status <> 'accepted' then
    -- Selection can continue after the application deadline, until the program ends.
    if v_program.status <> 'published' or (now() at time zone 'Asia/Almaty')::date > v_program.ends_on
      or not exists (select 1 from public.scientist_profiles where id = v_program.coordinator_id and status = 'verified' and deleted_at is null)
      or not exists (select 1 from public.scientific_fields where id = v_program.field_id and is_active)
      then raise exception 'not_available'; end if;
    if (select count(*) from public.research_program_applications where program_id = v_old.program_id and status in ('accepted', 'completed') and deleted_at is null) >= v_program.capacity
      then raise exception 'capacity_exceeded'; end if;
  end if;
  update public.research_program_applications set status = p_status, manager_note = p_note where id = p_id;
  -- Personal data and internal notes are deliberately absent from audit payloads.
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (p_actor, 'research_program_application', p_id, 'research_program.application.update',
      jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.save_research_program(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.change_research_program_state(uuid, uuid, public.research_program_status, boolean) from public, anon, authenticated;
revoke all on function public.submit_research_program_application(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_research_program_application(uuid, uuid, public.research_program_application_status, text) from public, anon, authenticated;
grant execute on function public.save_research_program(uuid, uuid, jsonb) to service_role;
grant execute on function public.change_research_program_state(uuid, uuid, public.research_program_status, boolean) to service_role;
grant execute on function public.submit_research_program_application(uuid, jsonb) to service_role;
grant execute on function public.update_research_program_application(uuid, uuid, public.research_program_application_status, text) to service_role;
