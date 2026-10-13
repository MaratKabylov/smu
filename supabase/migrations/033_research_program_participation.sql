-- Each existing program is one intake, identified by its recruitment/study dates.
-- Participation belongs to the application, so a later verified email claim keeps it.
create table public.research_program_participations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.research_program_applications(id) on delete restrict,
  mentor_id uuid references public.scientist_profiles(id) on delete restrict,
  status text not null check(status in ('active','completed')),
  version integer not null default 1 check(version > 0),
  baseline boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.research_program_participations enable row level security;
revoke all on public.research_program_participations from public,anon,authenticated,service_role;
grant select on public.research_program_participations to authenticated;
create policy program_participations_manager on public.research_program_participations for select to authenticated
  using(public.has_permission('admin.access') and public.has_permission('research_program.manage'));
-- Record only the observed state; neither past acceptance dates nor mentors are inferred.
insert into public.research_program_participations(application_id,status,baseline)
select id,case when status='completed' then 'completed' else 'active' end,true
from public.research_program_applications where status in ('accepted','completed');

alter function public.update_research_program_application(uuid,uuid,public.research_program_application_status,text)
  rename to update_research_program_application_core;
revoke all on function public.update_research_program_application_core(uuid,uuid,public.research_program_application_status,text)
  from public,anon,authenticated,service_role;

create function public.smu_decide_research_program(p_id uuid,p_actor uuid,p_status public.research_program_application_status,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare v_program uuid; v_old public.research_program_applications%rowtype;
begin
  if p_actor is null or not exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
      join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='admin.access')
    or not exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
      join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='research_program.manage')
    then raise exception 'forbidden'; end if;
  if p_note is null then raise exception 'invalid_input'; end if;
  select program_id into v_program from public.research_program_applications where id=p_id and deleted_at is null;
  perform 1 from public.research_programs where id=v_program and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_old from public.research_program_applications where id=p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_status=v_old.status and p_note=v_old.manager_note then return; end if;
  perform public.update_research_program_application_core(p_id,p_actor,p_status,p_note);
  if p_status is distinct from v_old.status then
    if p_status='accepted' then
      insert into public.research_program_participations(application_id,status) values(p_id,'active');
    elsif p_status='completed' then
      update public.research_program_participations set status='completed',version=version+1,updated_at=now()
        where application_id=p_id and status='active';
      if not found then raise exception 'invalid_transition'; end if;
    end if;
  end if;
end $$;
revoke all on function public.smu_decide_research_program(uuid,uuid,public.research_program_application_status,text)
  from public,anon,authenticated,service_role;

create function public.update_research_program_application(p_id uuid,p_actor uuid,p_status public.research_program_application_status,p_note text)
returns void language sql security definer set search_path='' as $$
  select public.smu_decide_research_program(p_id,p_actor,p_status,p_note);
$$;
revoke all on function public.update_research_program_application(uuid,uuid,public.research_program_application_status,text)
  from public,anon,authenticated,service_role;
grant execute on function public.update_research_program_application(uuid,uuid,public.research_program_application_status,text) to service_role;

create function public.decide_research_program_application(p_id uuid,p_status public.research_program_application_status,p_note text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  perform public.smu_decide_research_program(p_id,auth.uid(),p_status,p_note);
end $$;
revoke all on function public.decide_research_program_application(uuid,public.research_program_application_status,text)
  from public,anon,authenticated,service_role;
grant execute on function public.decide_research_program_application(uuid,public.research_program_application_status,text) to authenticated;

create function public.assign_research_program_mentor(p_application uuid,p_mentor uuid,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_program uuid; v_old public.research_program_participations%rowtype;
begin
  if auth.uid() is null or not public.has_permission('admin.access') or not public.has_permission('research_program.manage')
    then raise exception 'forbidden'; end if;
  select program_id into v_program from public.research_program_applications where id=p_application and deleted_at is null;
  perform 1 from public.research_programs where id=v_program and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  perform 1 from public.research_program_applications where id=p_application and deleted_at is null and status='accepted' for update;
  if not found then raise exception 'invalid_transition'; end if;
  select * into v_old from public.research_program_participations where application_id=p_application for update;
  if not found or v_old.status<>'active' then raise exception 'invalid_transition'; end if;
  if p_version is null or p_version<>v_old.version then raise exception 'stale_version'; end if;
  if p_mentor is not null then
    perform 1 from public.scientist_profiles where id=p_mentor and status='verified' and is_public and deleted_at is null for share;
    if not found then raise exception 'invalid_reference'; end if;
  end if;
  if p_mentor is not distinct from v_old.mentor_id then return; end if;
  update public.research_program_participations set mentor_id=p_mentor,version=version+1,updated_at=now() where id=v_old.id;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
    values(auth.uid(),'research_program_participation',v_old.id,'research_program.mentor.assign',
      jsonb_build_object('mentorId',v_old.mentor_id),jsonb_build_object('mentorId',p_mentor));
end $$;
revoke all on function public.assign_research_program_mentor(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.assign_research_program_mentor(uuid,uuid,integer) to authenticated;

create function public.get_research_program_participation(p_application uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.has_permission('admin.access') or not public.has_permission('research_program.manage')
    then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('status',r.status,'mentorId',r.mentor_id,'version',r.version)
    from public.research_program_participations r join public.research_program_applications a on a.id=r.application_id
    join public.research_programs p on p.id=a.program_id
    where a.id=p_application and a.deleted_at is null and p.deleted_at is null);
end $$;
revoke all on function public.get_research_program_participation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_research_program_participation(uuid) to authenticated;

create function public.get_account_research_program(p_application uuid,p_locale text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_app public.research_program_applications%rowtype;
  v_program public.research_programs%rowtype; v_translation public.research_program_translations%rowtype;
  v_relation public.research_program_participations%rowtype; v_mentor jsonb;
begin
  if p_locale is null or p_locale not in ('ru','kk','en') then raise exception 'invalid_input'; end if;
  select * into v_app from public.research_program_applications where id=p_application and user_id=v_actor and deleted_at is null;
  if not found then return null; end if;
  select * into v_program from public.research_programs where id=v_app.program_id and deleted_at is null;
  if not found then return null; end if;
  select * into v_translation from public.research_program_translations where program_id=v_program.id
    order by (locale=p_locale) desc,(locale='ru') desc,locale limit 1;
  select * into v_relation from public.research_program_participations where application_id=v_app.id;
  -- A mentor that later becomes private/deleted is represented as unavailable.
  select jsonb_build_object('name',t.full_name,'locale',t.locale,'slug',t.slug) into v_mentor
    from public.scientist_profiles s join lateral (
      select * from public.scientist_profile_translations where scientist_profile_id=s.id
      order by (locale=p_locale) desc,(locale='ru') desc,locale limit 1
    ) t on true where s.id=v_relation.mentor_id and s.status='verified' and s.is_public and s.deleted_at is null;
  return jsonb_build_object('applicationStatus',v_app.status,
    'program',jsonb_build_object('title',coalesce(v_translation.title,''),'locale',v_translation.locale,'status',v_program.status,
      'applicationsOpenOn',v_program.applications_open_on,'applicationDeadline',v_program.application_deadline,
      'startsOn',v_program.starts_on,'endsOn',v_program.ends_on,'curriculum',coalesce(v_translation.curriculum,'')),
    'participation',case when v_relation.id is null then null else jsonb_build_object('status',v_relation.status,
      'createdAt',v_relation.created_at,'baseline',v_relation.baseline,'mentorAssigned',v_relation.mentor_id is not null,'mentor',v_mentor) end,
    'projects',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'title',coalesce(t.title,''),'locale',t.locale,
      'status',w.status,'summary',coalesce(t.summary,''),
      'outputs',public.list_public_research_outputs(p_locale,w.id)) order by w.id)
      from public.research_program_project_participants l
      join public.science_works w on w.id=l.work_id and w.kind='project' and w.deleted_at is null
      join public.scientist_profiles s on s.id=l.scientist_id and s.user_id=v_actor and s.deleted_at is null
      join public.science_work_members m on m.work_id=w.id and m.scientist_id=s.id
      left join lateral (select * from public.science_work_translations where work_id=w.id
        order by (locale=p_locale) desc,(locale='ru') desc,locale limit 1) t on true
      where l.program_id=v_program.id and l.application_id=v_app.id
        and v_app.status in ('accepted','completed') and v_relation.id is not null),'[]'));
end $$;
revoke all on function public.get_account_research_program(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_account_research_program(uuid,text) to authenticated;

alter function public.list_account_records(text,text,integer,uuid) rename to list_account_records_core;
revoke all on function public.list_account_records_core(text,text,integer,uuid) from public,anon,authenticated,service_role;
create function public.list_account_records(p_locale text,p_section text,p_page integer default 1,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_result jsonb;
begin
  if p_section is distinct from 'research-program' then
    return public.list_account_records_core(p_locale,p_section,p_page,p_id);
  end if;
  if p_locale is null or p_locale not in ('ru','kk','en') or p_page is null or p_page not between 1 and 100000
    then raise exception 'invalid_input'; end if;
  with records as (
    select a.id,t.title,a.status::text status,a.updated_at,t.locale,
      case when p_id is not null then a.motivation else null end body
    from public.research_program_applications a
    join public.research_program_participations r on r.application_id=a.id
    join public.research_programs p on p.id=a.program_id and p.deleted_at is null
    left join lateral (select * from public.research_program_translations where program_id=p.id
      order by (locale=p_locale) desc,(locale='ru') desc,locale limit 1) t on true
    where a.user_id=v_actor and a.deleted_at is null and a.status in ('accepted','completed') and (p_id is null or a.id=p_id)
  ), page as (select * from records order by updated_at desc,id limit 20 offset ((p_page-1)*20))
  select jsonb_build_object('total',(select count(*) from records),'page',p_page,'pageSize',20,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind','program_application','title',coalesce(title,''),
      'status',status,'updatedAt',updated_at,'locale',locale,'summary',null,'body',body,'content',null,'relationship','applicant')
      order by updated_at desc,id) from page),'[]')) into v_result;
  return v_result;
end $$;
revoke all on function public.list_account_records(text,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_account_records(text,text,integer,uuid) to authenticated;
