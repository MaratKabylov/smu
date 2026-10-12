-- Preserve existing application codes and add an explicit terminal withdrawal.
alter type public.mentorship_application_status add value if not exists 'withdrawn';

create table public.mentorship_relations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.mentorship_applications(id) on delete restrict,
  mentor_id uuid not null references public.scientist_profiles(id) on delete restrict,
  kind text not null default 'mentor' check(kind in ('mentor','consultant','project_supervisor','coauthor','reviewer','research_program_mentor')),
  status text not null default 'active' check(status in ('active','paused','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.mentorship_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.mentorship_applications(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  scope text not null check(scope in ('application','relation')),
  from_status text,
  to_status text not null,
  baseline boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index mentorship_decisions_history_idx on public.mentorship_decisions(application_id,created_at desc,id desc);
alter table public.mentorship_relations enable row level security;
alter table public.mentorship_decisions enable row level security;
revoke all on public.mentorship_relations,public.mentorship_decisions from public,anon,authenticated,service_role;
grant select on public.mentorship_relations,public.mentorship_decisions to authenticated;
create policy mentorship_relations_managers on public.mentorship_relations for select to authenticated
  using(public.has_permission('admin.access') and public.has_permission('mentorship.manage'));
create policy mentorship_decisions_managers on public.mentorship_decisions for select to authenticated
  using(public.has_permission('admin.access') and public.has_permission('mentorship.manage'));

-- A baseline records the state observed during upgrade, not a fabricated past decision.
insert into public.mentorship_relations(application_id,mentor_id,status)
select a.id,o.scientist_id,case when a.status::text='completed' then 'completed' else 'active' end
from public.mentorship_applications a join public.mentorship_offers o on o.id=a.offer_id
where a.status::text in ('accepted','completed');
insert into public.mentorship_decisions(application_id,scope,to_status,baseline)
select id,'application',status::text,true from public.mentorship_applications;
insert into public.mentorship_decisions(application_id,scope,to_status,baseline)
select application_id,'relation',status,true from public.mentorship_relations;

-- Keep the trusted legacy API consistent, while the application switches to a session RPC.
alter function public.update_mentorship_application(uuid,uuid,public.mentorship_application_status,text)
  rename to update_mentorship_application_core;
revoke all on function public.update_mentorship_application_core(uuid,uuid,public.mentorship_application_status,text)
  from public,anon,authenticated,service_role;

create function public.smu_decide_mentorship(p_id uuid,p_actor uuid,p_status public.mentorship_application_status,p_note text,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
declare v_old public.mentorship_applications%rowtype; v_offer uuid; v_relation public.mentorship_relations%rowtype;
begin
  if p_actor is null or not exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
      join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='admin.access')
    or not exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
      join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='mentorship.manage')
    then raise exception 'forbidden'; end if;
  if p_kind is null or p_kind not in ('mentor','consultant','project_supervisor','coauthor','reviewer','research_program_mentor')
    or p_note is null then raise exception 'invalid_input'; end if;
  select offer_id into v_offer from public.mentorship_applications where id=p_id and deleted_at is null;
  perform 1 from public.mentorship_offers where id=v_offer and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_old from public.mentorship_applications where id=p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_status=v_old.status and p_note=v_old.manager_note then return; end if;
  -- Existing validation still owns availability, transition and capacity checks.
  perform public.update_mentorship_application_core(p_id,p_actor,p_status,p_note);
  if p_status is distinct from v_old.status then
    insert into public.mentorship_decisions(application_id,actor_id,scope,from_status,to_status)
      values(p_id,p_actor,'application',v_old.status::text,p_status::text);
    if p_status::text='accepted' then
      insert into public.mentorship_relations(application_id,mentor_id,kind)
        select p_id,scientist_id,p_kind from public.mentorship_offers where id=v_offer;
      insert into public.mentorship_decisions(application_id,actor_id,scope,to_status) values(p_id,p_actor,'relation','active');
    elsif p_status::text='completed' then
      select * into v_relation from public.mentorship_relations where application_id=p_id for update;
      if not found or v_relation.status not in ('active','paused') then raise exception 'invalid_transition'; end if;
      update public.mentorship_relations set status='completed',updated_at=now() where id=v_relation.id;
      insert into public.mentorship_decisions(application_id,actor_id,scope,from_status,to_status)
        values(p_id,p_actor,'relation',v_relation.status,'completed');
    end if;
  end if;
end $$;
revoke all on function public.smu_decide_mentorship(uuid,uuid,public.mentorship_application_status,text,text) from public,anon,authenticated,service_role;

create function public.update_mentorship_application(p_id uuid,p_actor uuid,p_status public.mentorship_application_status,p_note text)
returns void language sql security definer set search_path='' as $$
  select public.smu_decide_mentorship(p_id,p_actor,p_status,p_note,'mentor');
$$;
revoke all on function public.update_mentorship_application(uuid,uuid,public.mentorship_application_status,text) from public,anon,authenticated,service_role;
grant execute on function public.update_mentorship_application(uuid,uuid,public.mentorship_application_status,text) to service_role;

create function public.decide_mentorship_application(p_id uuid,p_status public.mentorship_application_status,p_note text,p_kind text default 'mentor')
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  perform public.smu_decide_mentorship(p_id,auth.uid(),p_status,p_note,p_kind);
end $$;
revoke all on function public.decide_mentorship_application(uuid,public.mentorship_application_status,text,text) from public,anon,authenticated,service_role;
grant execute on function public.decide_mentorship_application(uuid,public.mentorship_application_status,text,text) to authenticated;

create function public.change_mentorship_relation(p_application uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_offer uuid; v_application public.mentorship_applications%rowtype; v_old public.mentorship_relations%rowtype;
begin
  if v_actor is null or not public.has_permission('admin.access') or not public.has_permission('mentorship.manage') then raise exception 'forbidden'; end if;
  if p_status is null or p_status not in ('active','paused','completed','cancelled') then raise exception 'invalid_input'; end if;
  select offer_id into v_offer from public.mentorship_applications where id=p_application and deleted_at is null;
  perform 1 from public.mentorship_offers where id=v_offer and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_application from public.mentorship_applications where id=p_application and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_old from public.mentorship_relations where application_id=p_application for update;
  if not found then raise exception 'not_found'; end if;
  if p_status=v_old.status then return; end if;
  if v_application.status::text<>'accepted' or v_old.status not in ('active','paused')
    then raise exception 'invalid_transition'; end if;
  if p_status='completed' then
    perform public.smu_decide_mentorship(p_application,v_actor,'completed',v_application.manager_note,v_old.kind);
    return;
  end if;
  update public.mentorship_relations set status=p_status,updated_at=now() where id=v_old.id;
  insert into public.mentorship_decisions(application_id,actor_id,scope,from_status,to_status)
    values(p_application,v_actor,'relation',v_old.status,p_status);
  if p_status='cancelled' then
    update public.mentorship_applications set status='withdrawn' where id=p_application;
    insert into public.mentorship_decisions(application_id,actor_id,scope,from_status,to_status)
      values(p_application,v_actor,'application','accepted','withdrawn');
  end if;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
    values(v_actor,'mentorship_relation',v_old.id,'mentorship.relation.change',jsonb_build_object('status',v_old.status),jsonb_build_object('status',p_status));
end $$;
revoke all on function public.change_mentorship_relation(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.change_mentorship_relation(uuid,text) to authenticated;

create function public.withdraw_mentorship_application(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_offer uuid; v_old public.mentorship_applications%rowtype; v_relation public.mentorship_relations%rowtype;
begin
  select offer_id into v_offer from public.mentorship_applications where id=p_id and user_id=v_actor and deleted_at is null;
  perform 1 from public.mentorship_offers where id=v_offer and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_old from public.mentorship_applications where id=p_id and user_id=v_actor and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if v_old.status::text='withdrawn' then return; end if;
  if v_old.status::text not in ('new','in_review','accepted') then raise exception 'invalid_transition'; end if;
  if v_old.status::text='accepted' then
    select * into v_relation from public.mentorship_relations where application_id=p_id for update;
    if not found or v_relation.status not in ('active','paused') then raise exception 'invalid_transition'; end if;
    update public.mentorship_relations set status='cancelled',updated_at=now() where id=v_relation.id;
    insert into public.mentorship_decisions(application_id,actor_id,scope,from_status,to_status)
      values(p_id,v_actor,'relation',v_relation.status,'cancelled');
  end if;
  update public.mentorship_applications set status='withdrawn' where id=p_id;
  insert into public.mentorship_decisions(application_id,actor_id,scope,from_status,to_status)
    values(p_id,v_actor,'application',v_old.status::text,'withdrawn');
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
    values(v_actor,'mentorship_application',p_id,'mentorship.application.withdraw',jsonb_build_object('status',v_old.status),jsonb_build_object('status','withdrawn'));
end $$;
revoke all on function public.withdraw_mentorship_application(uuid) from public,anon,authenticated,service_role;
grant execute on function public.withdraw_mentorship_application(uuid) to authenticated;

create function public.get_mentorship_progress(p_application uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_manager boolean; v_app public.mentorship_applications%rowtype;
begin
  if v_actor is null then raise exception 'forbidden'; end if;
  v_manager:=public.has_permission('admin.access') and public.has_permission('mentorship.manage');
  if not v_manager then perform public.smu_account_user_id(); end if;
  select a.* into v_app from public.mentorship_applications a join public.mentorship_offers o on o.id=a.offer_id
    where a.id=p_application and a.deleted_at is null and o.deleted_at is null and (v_manager or a.user_id=v_actor);
  if not found then return null; end if;
  -- No contact data, internal notes or decision-maker identity in this projection.
  return jsonb_build_object('applicationStatus',v_app.status,
    'relation',(select jsonb_build_object('id',r.id,'kind',r.kind,'status',r.status,'updatedAt',r.updated_at)
      from public.mentorship_relations r where r.application_id=p_application),
    'historyTotal',(select count(*) from public.mentorship_decisions d where d.application_id=p_application),
    'history',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'scope',d.scope,'fromStatus',d.from_status,'toStatus',d.to_status,'baseline',d.baseline,'createdAt',d.created_at) order by d.created_at desc,d.id desc)
      from (select * from public.mentorship_decisions where application_id=p_application order by created_at desc,id desc limit 100) d),'[]'::jsonb));
end $$;
revoke all on function public.get_mentorship_progress(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_mentorship_progress(uuid) to authenticated;

create function public.smu_mentorship_application_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.mentorship_decisions(application_id,scope,to_status)
    values(new.id,'application',new.status::text);
  return new;
end $$;
revoke all on function public.smu_mentorship_application_history() from public,anon,authenticated,service_role;
create trigger mentorship_application_history after insert on public.mentorship_applications
  for each row execute function public.smu_mentorship_application_history();
