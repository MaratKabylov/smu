-- Programs reference the shared project model; application identity stays private.
alter table public.research_programs add column projects_version integer not null default 0;
create table public.research_program_projects (
  program_id uuid not null references public.research_programs(id) on delete cascade,
  work_id uuid not null references public.science_works(id) on delete restrict,
  primary key(program_id,work_id)
);
create index research_program_projects_work_idx on public.research_program_projects(work_id);
create table public.research_program_project_participants (
  program_id uuid not null,
  work_id uuid not null,
  application_id uuid not null references public.research_program_applications(id) on delete restrict,
  scientist_id uuid not null references public.scientist_profiles(id) on delete restrict,
  primary key(program_id,work_id,application_id),
  unique(program_id,work_id,scientist_id),
  foreign key(program_id,work_id) references public.research_program_projects(program_id,work_id) on delete cascade
);
alter table public.research_program_projects enable row level security;
alter table public.research_program_project_participants enable row level security;
revoke all on public.research_program_projects, public.research_program_project_participants from anon,authenticated;
grant select on public.research_program_projects, public.research_program_project_participants to authenticated;
create policy program_projects_manager on public.research_program_projects for select to authenticated
using(public.has_permission('admin.access') and public.has_permission('research_program.manage'));
create policy program_participants_manager on public.research_program_project_participants for select to authenticated
using(public.has_permission('admin.access') and public.has_permission('research_program.manage'));

create function public.save_research_program_projects(p_id uuid,p_input jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v_program public.research_programs%rowtype; v_work uuid; v_item jsonb; v_old jsonb;
begin
  if auth.uid() is null or not public.has_permission('admin.access') or not public.has_permission('research_program.manage')
    then raise exception 'forbidden'; end if;
  select * into v_program from public.research_programs where id=p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'invalid_input'; end if;
  if jsonb_typeof(p_input->'expectedVersion') is distinct from 'number'
    or p_input->>'expectedVersion' <> v_program.projects_version::text then raise exception 'stale_version'; end if;
  if jsonb_typeof(p_input->'workIds') is distinct from 'array' or jsonb_typeof(p_input->'participants') is distinct from 'array'
    then raise exception 'invalid_input'; end if;
  if jsonb_array_length(p_input->'workIds')>20 or jsonb_array_length(p_input->'participants')>500
    or exists(select 1 from jsonb_array_elements(p_input->'workIds') x where jsonb_typeof(x)<>'string')
    or (select count(distinct x) from jsonb_array_elements_text(p_input->'workIds') x)<>jsonb_array_length(p_input->'workIds')
    then raise exception 'invalid_input'; end if;
  for v_work in select x::uuid from jsonb_array_elements_text(p_input->'workIds') x order by x loop
    perform 1 from public.science_works where id=v_work and kind='project' and deleted_at is null for update;
    if not found then raise exception 'invalid_reference'; end if;
  end loop;
  for v_item in select x from jsonb_array_elements(p_input->'participants') x loop
    if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item->'applicationId') is distinct from 'string'
      or jsonb_typeof(v_item->'scientistId') is distinct from 'string' or jsonb_typeof(v_item->'workId') is distinct from 'string'
      or not (p_input->'workIds' ? (v_item->>'workId')) then raise exception 'invalid_input'; end if;
    perform 1 from public.research_program_applications where id=(v_item->>'applicationId')::uuid
      and program_id=p_id and status in ('accepted','completed') and deleted_at is null for update;
    if not found then raise exception 'invalid_reference'; end if;
    perform 1 from public.scientist_profiles where id=(v_item->>'scientistId')::uuid and deleted_at is null for share;
    if not found then raise exception 'invalid_reference'; end if;
    perform 1 from public.science_work_members where work_id=(v_item->>'workId')::uuid
      and scientist_id=(v_item->>'scientistId')::uuid for share;
    if not found then raise exception 'invalid_reference'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_input->'participants') x group by x->>'applicationId'
      having count(distinct x->>'scientistId')>1)
    or exists(select 1 from jsonb_array_elements(p_input->'participants') x group by x->>'scientistId'
      having count(distinct x->>'applicationId')>1) then raise exception 'invalid_input'; end if;
  select jsonb_build_object('workIds',coalesce((select jsonb_agg(work_id order by work_id) from public.research_program_projects where program_id=p_id),'[]'),
    'participants',coalesce((select jsonb_agg(jsonb_build_object('workId',work_id,'applicationId',application_id,'scientistId',scientist_id))
    from public.research_program_project_participants where program_id=p_id),'[]')) into v_old;
  delete from public.research_program_projects where program_id=p_id;
  insert into public.research_program_projects select p_id,x::uuid from jsonb_array_elements_text(p_input->'workIds') x;
  insert into public.research_program_project_participants
    select p_id,(x->>'workId')::uuid,(x->>'applicationId')::uuid,(x->>'scientistId')::uuid from jsonb_array_elements(p_input->'participants') x;
  update public.research_programs set projects_version=projects_version+1 where id=p_id;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
    values(auth.uid(),'research_program',p_id,'research_program.projects.update',v_old,p_input - 'expectedVersion');
  return v_program.projects_version+1;
end;
$$;

create function public.research_program_project_options(p_query text default '',p_ids uuid[] default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.has_permission('admin.access') or not public.has_permission('research_program.manage')
    then raise exception 'forbidden'; end if;
  if length(p_query)>120 or cardinality(p_ids)>20 then raise exception 'invalid_input'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'title',coalesce(t.title,'Без перевода'),'status',w.status,
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',coalesce(st.full_name,'Без перевода')) order by s.id)
      from public.science_work_members m join public.scientist_profiles s on s.id=m.scientist_id and s.deleted_at is null
      left join public.scientist_profile_translations st on st.scientist_profile_id=s.id and st.locale='ru' where m.work_id=w.id),'[]')) order by w.id)
    from (select w.* from public.science_works w where w.kind='project' and w.deleted_at is null
      and (case when p_ids is not null then w.id=any(p_ids) else p_query='' or exists(select 1 from public.science_work_translations t
        where t.work_id=w.id and strpos(lower(t.title),lower(p_query))>0) end)
      order by w.updated_at desc,w.id limit 50) w
    left join public.science_work_translations t on t.work_id=w.id and t.locale='ru'),'[]');
end;
$$;

create function public.get_research_program_projects(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_program public.research_programs%rowtype;
begin
  if auth.uid() is null or not public.has_permission('admin.access') or not public.has_permission('research_program.manage')
    then raise exception 'forbidden'; end if;
  select * into v_program from public.research_programs where id=p_id and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('version',v_program.projects_version,
    'workIds',coalesce((select jsonb_agg(work_id order by work_id) from public.research_program_projects where program_id=p_id),'[]'),
    'participants',coalesce((select jsonb_agg(jsonb_build_object('workId',work_id,'applicationId',application_id,'scientistId',scientist_id))
      from public.research_program_project_participants where program_id=p_id),'[]'),
    'applications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name,'status',status) order by created_at,id)
      from public.research_program_applications where program_id=p_id and deleted_at is null and status in ('accepted','completed')),'[]'));
end;
$$;

create function public.list_public_research_program_projects(p_id uuid,p_locale text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'title',t.title,'slug',t.slug,
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',st.full_name,'slug',st.slug) order by s.id)
      from public.science_work_members m join public.scientist_profiles s on s.id=m.scientist_id
      join public.scientist_profile_translations st on st.scientist_profile_id=s.id and st.locale=p_locale
      where m.work_id=w.id and s.status='verified' and s.is_public and s.deleted_at is null),'[]')) order by w.id),'[]')
  from public.research_program_projects l join public.research_programs p on p.id=l.program_id
  join public.science_works w on w.id=l.work_id join public.science_work_translations t on t.work_id=w.id and t.locale=p_locale
  join public.scientist_profiles c on c.id=p.coordinator_id
  where p.id=p_id and p.status='published' and p.deleted_at is null
    and c.status='verified' and c.is_public and c.deleted_at is null
    and exists(select 1 from public.scientist_profile_translations where scientist_profile_id=c.id and locale=p_locale)
    and exists(select 1 from public.research_program_translations where program_id=p.id and locale=p_locale)
    and exists(select 1 from public.scientific_fields where id=p.field_id and is_active)
    and w.kind='project' and w.status='published' and w.published_at<=now() and w.deleted_at is null
    and exists(select 1 from public.scientific_fields where id=w.field_id and is_active);
$$;
revoke all on function public.save_research_program_projects(uuid,jsonb),public.get_research_program_projects(uuid),
  public.research_program_project_options(text,uuid[]),public.list_public_research_program_projects(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.save_research_program_projects(uuid,jsonb),public.get_research_program_projects(uuid),
  public.research_program_project_options(text,uuid[]) to authenticated;
grant execute on function public.list_public_research_program_projects(uuid,text) to anon,authenticated;

create function public.list_public_programs_by_project(p_work_id uuid,p_locale text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',t.title,'slug',t.slug) order by p.id),'[]')
  from public.research_program_projects l join public.research_programs p on p.id=l.program_id
  join public.research_program_translations t on t.program_id=p.id and t.locale=p_locale
  where l.work_id=p_work_id and public.list_public_research_program_projects(p.id,p_locale)
    @> jsonb_build_array(jsonb_build_object('id',p_work_id));
$$;
revoke all on function public.list_public_programs_by_project(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.list_public_programs_by_project(uuid,text) to anon,authenticated;
