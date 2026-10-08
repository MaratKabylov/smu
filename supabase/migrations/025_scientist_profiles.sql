-- Stage 4: verification is independent of public visibility. Keep the legacy
-- draft/verified column synchronized for existing joins and integrations.
alter table public.scientist_profiles
  add column verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  add column verification_note text,
  add column is_public boolean not null default true,
  add column collaboration jsonb not null default '{}'::jsonb check (jsonb_typeof(collaboration) = 'object'),
  add column content_version integer not null default 1 check(content_version > 0),
  add column merged_into_id uuid references public.scientist_profiles(id) on delete restrict,
  add constraint scientist_merge_deleted check(merged_into_id is null or (deleted_at is not null and merged_into_id <> id));
update public.scientist_profiles set verification_status = case when status='verified' then 'verified' else 'unverified' end;

create function public.sync_scientist_verification() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.status='verified' then new.verification_status:='verified'; end if;
  elsif new.verification_status is distinct from old.verification_status then
    new.status:=case when new.verification_status='verified' then 'verified'::public.scientist_profile_status else 'draft'::public.scientist_profile_status end;
  elsif new.status is distinct from old.status then
    new.verification_status:=case when new.status='verified' then 'verified' else 'unverified' end;
  end if;
  if new.verification_status<>'verified' then new.verified_at:=null; new.verified_by:=null; end if;
  if tg_op='UPDATE' and old.merged_into_id is not null and new.deleted_at is null then raise exception 'invalid_transition'; end if;
  return new;
end $$;
revoke all on function public.sync_scientist_verification() from public,anon,authenticated,service_role;
create trigger scientist_verification_sync before insert or update on public.scientist_profiles
for each row execute function public.sync_scientist_verification();

create table public.scientist_links (
  scientist_id uuid not null references public.scientist_profiles(id) on delete cascade,
  type text not null check(type in ('orcid','google_scholar','scopus','researchgate','linkedin','website')),
  url text not null check(length(url) <= 500 and url ~* '^https?://' and url !~ '[[:space:][:cntrl:]]' and url !~* '^https?://[^/]*@'),
  primary key(scientist_id,type)
);
insert into public.scientist_links select id,'orcid','https://orcid.org/' || orcid from public.scientist_profiles where orcid is not null;
insert into public.scientist_links select id,case when scholar_url ~* '^https://scholar[.]google[.]com/' then 'google_scholar' else 'website' end,scholar_url from public.scientist_profiles where scholar_url ~* '^https?://' and scholar_url !~ '[[:space:][:cntrl:]]' and scholar_url !~* '^https?://[^/]*@';
alter table public.scientist_links enable row level security;
revoke all on public.scientist_links from public,anon,authenticated,service_role;
grant select on public.scientist_links to anon,authenticated;
create policy scientist_links_visible on public.scientist_links for select to anon,authenticated using (
  exists(select 1 from public.scientist_profiles s where s.id=scientist_id)
);

create table public.scientist_merges (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.scientist_profiles(id) on delete restrict,
  target_id uuid not null references public.scientist_profiles(id) on delete restrict,
  merged_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check(length(btrim(reason)) between 10 and 2000),
  source_snapshot jsonb not null, target_snapshot jsonb not null,
  created_at timestamptz not null default now(), check(source_id <> target_id)
);
alter table public.scientist_merges enable row level security;
revoke all on public.scientist_merges from public,anon,authenticated,service_role;
grant select on public.scientist_merges to authenticated;
create policy scientist_merges_managers on public.scientist_merges for select to authenticated using (
  public.has_permission('admin.access') and public.has_permission('scientists.merge')
);
insert into public.permissions(code,name) values('scientists.merge','Объединение дубликатов научных профилей') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('admin','super_admin','scientist_manager') and p.code='scientists.merge' on conflict do nothing;

-- Apply privacy to every existing public projection, including security-definer
-- functions invoked by an administrator. Fail if a required object is missing.
do $$
declare v_name text; v_definition text; v_policy record;
begin
  foreach v_name in array array['smu_public_relation_targets','search_entries'] loop
    v_definition:=pg_get_viewdef(('public.' || v_name)::regclass,true);
    v_definition:=replace(v_definition, 's.status = ''verified''::scientist_profile_status', 's.status = ''verified''::scientist_profile_status AND s.is_public');
    -- pg_get_viewdef includes the schema on enum casts when search_path is empty.
    v_definition:=replace(v_definition, 's.status = ''verified''::public.scientist_profile_status', 's.status = ''verified''::public.scientist_profile_status AND s.is_public');
    execute format('create or replace view public.%I as %s',v_name,v_definition);
  end loop;
  foreach v_name in array array[
    'public.list_public_publications(text,uuid,uuid)',
    'public.save_science_work_required_locales(uuid,public.science_work_kind,uuid,jsonb)',
    'public.change_science_work_state(uuid,public.science_work_kind,uuid,public.science_work_status,boolean)',
    'public.save_mentorship_offer_required_locales(uuid,uuid,jsonb)',
    'public.change_mentorship_offer_state(uuid,uuid,public.mentorship_offer_status,boolean)',
    'public.submit_mentorship_application(uuid,jsonb)',
    'public.update_mentorship_application(uuid,uuid,public.mentorship_application_status,text)',
    'public.save_research_program_required_locales(uuid,uuid,jsonb)',
    'public.change_research_program_state(uuid,uuid,public.research_program_status,boolean)',
    'public.submit_research_program_application(uuid,jsonb)',
    'public.update_research_program_application(uuid,uuid,public.research_program_application_status,text)'
  ] loop
    if to_regprocedure(v_name) is null then raise exception 'missing routine: %',v_name; end if;
    v_definition:=pg_get_functiondef(to_regprocedure(v_name)::oid);
    v_definition:=replace(v_definition, 's.status = ''verified''', 's.status = ''verified'' and s.is_public');
    v_definition:=replace(v_definition, 'and status = ''verified''', 'and status = ''verified'' and is_public');
    v_definition:=replace(v_definition, 's.status <> ''verified''', 's.status <> ''verified'' or not s.is_public');
    execute v_definition;
  end loop;
  for v_policy in select * from pg_policies where schemaname='public' and qual like '%verified%' loop
    v_definition:=v_policy.qual;
    if v_policy.tablename='scientist_profiles' then v_definition:='(' || v_definition || ') AND is_public';
    else v_definition:=replace(v_definition, 's.status = ''verified''::scientist_profile_status', 's.status = ''verified''::scientist_profile_status AND s.is_public'); end if;
    execute format('alter policy %I on public.%I using (%s)',v_policy.policyname,v_policy.tablename,v_definition);
  end loop;
end $$;

-- The established save remains internal; all new edits must name their version.
alter function public.save_scientist(uuid,jsonb) rename to save_scientist_core;
revoke all on function public.save_scientist_core(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.save_scientist(p_id uuid,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.scientist_profiles%rowtype; v_link jsonb; v_key text; v_url text; v_links jsonb; v_collaboration jsonb;
begin
  perform public.require_smu_session();
  if not public.has_permission('scientists.edit') then raise exception 'forbidden'; end if;
  if p_id is not null then
    select * into v_old from public.scientist_profiles where id=p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    if (p_input->>'expectedContentVersion')::integer is distinct from v_old.content_version then raise exception 'stale_version'; end if;
  end if;
  v_links:=coalesce(p_input->'links','[]'::jsonb);
  v_collaboration:=coalesce(p_input->'collaboration','{}'::jsonb);
  if jsonb_typeof(v_links) is distinct from 'array' or jsonb_array_length(v_links)>6
    or jsonb_typeof(v_collaboration) is distinct from 'object'
    or (p_input ? 'isPublic' and jsonb_typeof(p_input->'isPublic') is distinct from 'boolean') then raise exception 'invalid_input'; end if;
  for v_key in select jsonb_object_keys(v_collaboration) loop
    if v_key not in ('collaboration','mentoring','media','students','projects','looking_for_students','coauthoring','reviewing','consulting','project_supervision')
      or jsonb_typeof(v_collaboration->v_key) is distinct from 'boolean' then raise exception 'invalid_input'; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'type') from jsonb_array_elements(v_links)) then raise exception 'invalid_input'; end if;
  -- Legacy ORCID/Scholar inputs are accepted and synchronized into typed links.
  if not exists(select 1 from jsonb_array_elements(v_links) l where l->>'type'='orcid') and nullif(p_input->>'orcid','') is not null then
    v_links:=v_links || jsonb_build_array(jsonb_build_object('type','orcid','url','https://orcid.org/' || (p_input->>'orcid')));
  end if;
  if not exists(select 1 from jsonb_array_elements(v_links) l where l->>'type'='google_scholar') and nullif(p_input->>'scholarUrl','') is not null then
    v_links:=v_links || jsonb_build_array(jsonb_build_object('type','google_scholar','url',p_input->>'scholarUrl'));
  end if;
  for v_link in select value from jsonb_array_elements(v_links) loop
    v_key:=v_link->>'type'; v_url:=v_link->>'url';
    if jsonb_typeof(v_link) is distinct from 'object' or coalesce(v_key,'') not in ('orcid','google_scholar','scopus','researchgate','linkedin','website')
      or coalesce(v_url,'') !~* '^https?://[^/?#]+' or length(v_url)>500 or v_url ~ '[[:space:][:cntrl:]]' or v_url ~* '^https?://[^/]*@'
      or (v_key='orcid' and v_url !~ '^https://orcid[.]org/[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$')
      or (v_key='google_scholar' and v_url !~* '^https://scholar[.]google[.]com/')
      or (v_key='scopus' and v_url !~* '^https://(www[.])?scopus[.]com/')
      or (v_key='researchgate' and v_url !~* '^https://(www[.])?researchgate[.]net/')
      or (v_key='linkedin' and v_url !~* '^https://(www[.])?linkedin[.]com/') then raise exception 'invalid_input'; end if;
  end loop;
  -- Untyped legacy Scholar URLs are retained by migration but new submissions
  -- must point to Scholar when classified as that link type.
  p_input:=p_input || jsonb_build_object(
    'orcid',(select substring(value->>'url' from '[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$') from jsonb_array_elements(v_links) where value->>'type'='orcid'),
    'scholarUrl',(select value->>'url' from jsonb_array_elements(v_links) where value->>'type'='google_scholar'));
  v_id:=public.save_scientist_core(p_id,p_input);
  update public.scientist_profiles set is_public=coalesce((p_input->>'isPublic')::boolean,true), collaboration=v_collaboration,
    verification_status='unverified', verification_note=null, content_version=case when p_id is null then 1 else v_old.content_version+1 end where id=v_id;
  delete from public.scientist_links where scientist_id=v_id;
  insert into public.scientist_links(scientist_id,type,url) select v_id,value->>'type',value->>'url' from jsonb_array_elements(v_links);
  return v_id;
end $$;
revoke all on function public.save_scientist(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_scientist(uuid,jsonb) to authenticated;

alter function public.change_scientist_state(uuid,public.scientist_profile_status,boolean) rename to change_scientist_state_core;
revoke all on function public.change_scientist_state_core(uuid,public.scientist_profile_status,boolean) from public,anon,authenticated,service_role;
-- Legacy endpoint is retained only for soft delete. Verification requires a version.
create function public.change_scientist_state(p_id uuid,p_status public.scientist_profile_status,p_delete boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.require_smu_session();
  if not public.has_permission(case when p_delete then 'scientists.edit' else 'scientists.verify' end) then raise exception 'forbidden'; end if;
  if not coalesce(p_delete,false) or p_status is not null then raise exception 'invalid_transition'; end if;
  perform public.change_scientist_state_core(p_id,null,true);
end $$;
revoke all on function public.change_scientist_state(uuid,public.scientist_profile_status,boolean) from public,anon,authenticated,service_role;
grant execute on function public.change_scientist_state(uuid,public.scientist_profile_status,boolean) to authenticated;

create function public.change_scientist_verification(p_id uuid,p_status text,p_expected_version integer,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_smu_session(); v_old public.scientist_profiles%rowtype;
begin
  if not public.has_permission('scientists.verify') then raise exception 'forbidden'; end if;
  if coalesce(p_status,'') not in ('unverified','pending','verified','rejected') or length(coalesce(p_note,''))>2000
    or (p_status='rejected' and length(btrim(coalesce(p_note,'')))<10) then raise exception 'invalid_input'; end if;
  select * into v_old from public.scientist_profiles where id=p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_expected_version is distinct from v_old.content_version then raise exception 'stale_version'; end if;
  if v_old.verification_status=p_status then raise exception 'invalid_transition'; end if;
  if p_status='verified' then
    if (select count(*) from public.scientist_profile_translations where scientist_profile_id=p_id and locale in ('ru','kk')) <> 2 then raise exception 'invalid_transition'; end if;
    if v_old.status='draft' then perform public.change_scientist_state_core(p_id,'verified',false); end if;
  elsif v_old.status='verified' then perform public.change_scientist_state_core(p_id,'draft',false); end if;
  update public.scientist_profiles set verification_status=p_status,verification_note=nullif(btrim(p_note),''),
    content_version=content_version+1 where id=p_id;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data) values
    (v_actor,'scientist_profile',p_id,'scientist.verification',jsonb_build_object('verificationStatus',v_old.verification_status,'contentVersion',v_old.content_version),
      jsonb_build_object('verificationStatus',p_status,'contentVersion',v_old.content_version+1));
end $$;
revoke all on function public.change_scientist_verification(uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.change_scientist_verification(uuid,text,integer,text) to authenticated;

create function public.link_scientist_account(p_id uuid,p_email text,p_expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_smu_session(); v_account uuid; v_old public.scientist_profiles%rowtype;
begin
  if not(public.has_permission('scientists.edit') and public.has_permission('users.manage')) then raise exception 'forbidden'; end if;
  if p_email is null or length(p_email)>254 then raise exception 'invalid_input'; end if;
  if btrim(p_email)<>'' then
    select id into v_account from auth.users where lower(email)=lower(btrim(p_email));
    if not found then raise exception 'invalid_reference'; end if;
    perform 1 from public.profiles where id=v_account for update;
  end if;
  select * into v_old from public.scientist_profiles where id=p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_expected_version is distinct from v_old.content_version then raise exception 'stale_version'; end if;
  if v_old.user_id is not distinct from v_account then raise exception 'invalid_transition'; end if;
  if v_account is not null and exists(select 1 from public.scientist_profiles where user_id=v_account and id<>p_id) then raise exception 'invalid_reference'; end if;
  update public.scientist_profiles set user_id=v_account,content_version=content_version+1 where id=p_id;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data) values
    (v_actor,'scientist_profile',p_id,'scientist.account.link',jsonb_build_object('accountId',v_old.user_id),jsonb_build_object('accountId',v_account));
end $$;
revoke all on function public.link_scientist_account(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.link_scientist_account(uuid,text,integer) to authenticated;

create function public.merge_scientists(p_source uuid,p_target uuid,p_source_version integer,p_target_version integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_smu_session(); v_source public.scientist_profiles%rowtype; v_target public.scientist_profiles%rowtype;
  v_member record; v_article record; v_t record; v_snapshot jsonb;
begin
  if not(public.has_permission('scientists.edit') and public.has_permission('scientists.merge')) then raise exception 'forbidden'; end if;
  if p_source is null or p_target is null or p_source=p_target or length(btrim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'invalid_input'; end if;
  -- Serialize against account assignment, then against profile edits in stable ID order.
  perform 1 from public.profiles where id in (select user_id from public.scientist_profiles where id in (p_source,p_target)) order by id for update;
  perform 1 from public.scientist_profiles where id in (p_source,p_target) order by id for update;
  select * into v_source from public.scientist_profiles where id=p_source and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  select * into v_target from public.scientist_profiles where id=p_target and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  if p_source_version is distinct from v_source.content_version or p_target_version is distinct from v_target.content_version then raise exception 'stale_version'; end if;
  if v_source.user_id is not null and not public.has_permission('users.manage') then raise exception 'forbidden'; end if;
  if (v_source.user_id is not null and v_target.user_id is not null)
    or (v_source.orcid is not null and v_target.orcid is not null and v_source.orcid<>v_target.orcid)
    or exists(select 1 from public.scientist_links s join public.scientist_links t on t.type=s.type and t.scientist_id=p_target
      where s.scientist_id=p_source and s.url<>t.url) then raise exception 'invalid_reference'; end if;
  if (select count(distinct scientific_field_id) from public.scientist_field_links where scientist_profile_id in (p_source,p_target))>20 then raise exception 'invalid_input'; end if;
  select jsonb_build_object('profile',to_jsonb(v_source),
    'translations',(select jsonb_agg(to_jsonb(t)) from public.scientist_profile_translations t where scientist_profile_id=p_source),
    'links',(select jsonb_agg(to_jsonb(l)) from public.scientist_links l where scientist_id=p_source),
    'fields',(select jsonb_agg(scientific_field_id) from public.scientist_field_links where scientist_profile_id=p_source),
    'works',(select jsonb_agg(to_jsonb(m)) from public.science_work_members m where scientist_id=p_source),
    'articles',(select jsonb_agg(to_jsonb(a)) from public.article_scientists a where scientist_id=p_source),
    'publications',(select jsonb_agg(id) from public.publications where scientist_id=p_source),
    'mentorshipOffers',(select jsonb_agg(id) from public.mentorship_offers where scientist_id=p_source),
    'programs',(select jsonb_agg(id) from public.research_programs where coordinator_id=p_source)) into v_snapshot;
  insert into public.scientist_merges(source_id,target_id,merged_by,reason,source_snapshot,target_snapshot)
    values(p_source,p_target,v_actor,btrim(p_reason),v_snapshot,jsonb_build_object('profile',to_jsonb(v_target),
      'links',(select jsonb_agg(to_jsonb(l)) from public.scientist_links l where scientist_id=p_target),
      'fields',(select jsonb_agg(scientific_field_id) from public.scientist_field_links where scientist_profile_id=p_target)));
  insert into public.scientist_field_links(scientist_profile_id,scientific_field_id)
    select p_target,scientific_field_id from public.scientist_field_links where scientist_profile_id=p_source on conflict do nothing;
  insert into public.scientist_links(scientist_id,type,url)
    select p_target,type,url from public.scientist_links where scientist_id=p_source on conflict do nothing;
  -- Move one scientific membership at a time: a source lead wins over the
  -- target's member role; removing it first respects the unique lead index.
  for v_member in select * from public.science_work_members where scientist_id=p_source order by work_id loop
    perform 1 from public.science_works where id=v_member.work_id for update;
    delete from public.science_work_members where work_id=v_member.work_id and scientist_id=p_source;
    insert into public.science_work_members(work_id,scientist_id,role) values(v_member.work_id,p_target,v_member.role)
      on conflict(work_id,scientist_id) do update set role=case when excluded.role='lead' then 'lead' else public.science_work_members.role end;
  end loop;
  update public.mentorship_offers set scientist_id=p_target where scientist_id=p_source;
  update public.research_programs set coordinator_id=p_target where coordinator_id=p_source;
  update public.publications set scientist_id=p_target where scientist_id=p_source;
  for v_article in select a.* from public.articles a where exists(select 1 from public.article_scientists l where l.article_id=a.id and l.scientist_id=p_source)
    order by a.id for update loop
    insert into public.article_scientists(article_id,scientist_id,relation_type,sort_order)
      select article_id,p_target,relation_type,sort_order from public.article_scientists where article_id=v_article.id and scientist_id=p_source
      on conflict(article_id,scientist_id) do nothing;
    delete from public.article_scientists where article_id=v_article.id and scientist_id=p_source;
    update public.articles set status='draft',content_version=content_version+1,approved_version=null,updated_by=v_actor,published_at=null where id=v_article.id;
    insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data) values
      (v_actor,'article',v_article.id,'article.scientist.merge',jsonb_build_object('status',v_article.status,'contentVersion',v_article.content_version),
        jsonb_build_object('status','draft','sourceId',p_source,'targetId',p_target,'contentVersion',v_article.content_version+1));
  end loop;
  -- Slug history follows the canonical profile; source translations stay in
  -- the deleted record, so neither current nor old addresses can be stolen.
  for v_t in select * from public.scientist_profile_translations where scientist_profile_id=p_source order by locale loop
    perform pg_advisory_xact_lock(hashtextextended('smu_slug:scientist:' || v_t.locale,0));
    insert into public.slug_redirects(entity_type,entity_id,locale,old_slug) values('scientist',p_target,v_t.locale,v_t.slug)
      on conflict(entity_type,locale,old_slug) do update set entity_id=p_target where slug_redirects.entity_id in (p_source,p_target);
    if not found then raise exception 'slug_reserved'; end if;
  end loop;
  update public.slug_redirects set entity_id=p_target where entity_type='scientist' and entity_id=p_source;
  update public.scientist_profiles set user_id=null,deleted_at=now(),merged_into_id=p_target,verification_status='unverified',content_version=content_version+1 where id=p_source;
  update public.scientist_profiles set user_id=coalesce(v_target.user_id,v_source.user_id),is_public=v_target.is_public and v_source.is_public,
    orcid=coalesce(v_target.orcid,v_source.orcid),scholar_url=coalesce(v_target.scholar_url,v_source.scholar_url),
    verification_status='unverified',verification_note=null,content_version=content_version+1 where id=p_target;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data) values
    (v_actor,'scientist_profile',p_target,'scientist.merge',jsonb_build_object('sourceId',p_source,'targetId',p_target));
end $$;
revoke all on function public.merge_scientists(uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.merge_scientists(uuid,uuid,integer,integer,text) to authenticated;

-- Public readers receive no account identity or internal review comments, even
-- when authenticated. Managers read complete records through a gated RPC.
revoke select on public.scientist_profiles from anon,authenticated;
grant select(id,organization_id,avatar_media_id,status,verification_status,is_public,collaboration,public_email,orcid,scholar_url,verified_at,created_at,updated_at,deleted_at,content_version)
  on public.scientist_profiles to anon,authenticated;
create function public.list_scientist_profiles(p_ids uuid[] default null,p_query text default '',p_status text default 'all')
returns setof public.scientist_profiles language plpgsql stable security definer set search_path='' as $$
begin
  perform public.require_smu_session();
  if not(public.has_permission('admin.access') and public.has_permission('scientists.edit')) then raise exception 'forbidden'; end if;
  if length(coalesce(p_query,''))>120 or coalesce(cardinality(p_ids),0)>100
    or coalesce(p_status,'') not in ('all','draft','unverified','pending','verified','rejected') then raise exception 'invalid_input'; end if;
  return query select s.* from public.scientist_profiles s where
    (p_ids is not null or s.deleted_at is null) and (p_ids is null or s.id=any(p_ids))
    and (p_status='all' or s.verification_status=case when p_status='draft' then 'unverified' else p_status end)
    and (coalesce(p_query,'')='' or exists(select 1 from public.scientist_profile_translations t where t.scientist_profile_id=s.id and t.full_name ilike '%' || p_query || '%'))
    order by s.updated_at desc,s.id limit 100;
end $$;
revoke all on function public.list_scientist_profiles(uuid[],text,text) from public,anon,authenticated,service_role;
grant execute on function public.list_scientist_profiles(uuid[],text,text) to authenticated;

-- A merged identity cannot be restored separately. Ordinary restore changes
-- the version so a form opened before deletion cannot overwrite it.
create or replace function public.restore_deleted_scientist(p_id uuid, p_expected_deleted_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_old public.scientist_profiles%rowtype; v_t record;
begin
  if not public.has_permission('scientists.edit') then raise exception 'forbidden'; end if;
  if p_expected_deleted_at is null then raise exception 'invalid_input'; end if;
  select * into v_old from public.scientist_profiles where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_old.merged_into_id is not null then raise exception 'invalid_transition'; end if;
  if v_old.deleted_at is distinct from p_expected_deleted_at then raise exception 'stale_version'; end if;
  perform 1 from public.scientific_organizations where id = v_old.organization_id for share;
  perform 1 from public.scientific_fields where id in
    (select scientific_field_id from public.scientist_field_links where scientist_profile_id = p_id) order by id for share;
  if (v_old.organization_id is not null and not exists(select 1 from public.scientific_organizations where id = v_old.organization_id and is_active))
    or exists(select 1 from public.scientist_field_links l join public.scientific_fields f on f.id = l.scientific_field_id where l.scientist_profile_id = p_id and not f.is_active)
    then raise exception 'invalid_reference'; end if;
  if v_old.avatar_media_id is not null then
    perform 1 from public.media_assets where id = v_old.avatar_media_id and status = 'ready' and deleted_at is null
      and storage_bucket = 'avatars' and mime_type like 'image/%' for share;
    if not found then raise exception 'invalid_reference'; end if;
  end if;
  for v_t in select * from public.scientist_profile_translations where scientist_profile_id = p_id order by locale loop
    perform public.preserve_smu_slug('scientist', p_id, v_t.locale, v_t.slug, v_t.slug, false);
  end loop;
  update public.scientist_profiles set deleted_at = null, status = 'draft', verified_at = null, verified_by = null, verification_status='unverified', verification_note=null, content_version=content_version+1 where id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values(v_actor, 'scientist_profile', p_id, 'scientist.restore',
      jsonb_build_object('status', v_old.status, 'deletedAt', v_old.deleted_at), jsonb_build_object('status', 'draft', 'deletedAt', null));
end;
$$;

create function public.scientist_linked_account(p_id uuid)
returns table(display_name text,email text) language plpgsql stable security definer set search_path='' as $$
begin
  perform public.require_smu_session();
  if not(public.has_permission('scientists.edit') and public.has_permission('users.manage')) then raise exception 'forbidden'; end if;
  return query select p.display_name,u.email::text from public.scientist_profiles s join public.profiles p on p.id=s.user_id
    join auth.users u on u.id=p.id where s.id=p_id and s.deleted_at is null;
end $$;
revoke all on function public.scientist_linked_account(uuid) from public,anon,authenticated,service_role;
grant execute on function public.scientist_linked_account(uuid) to authenticated;

-- Merged source records are history, rather than independently restorable trash.
create or replace function public.list_deleted_editorial_records(p_kind text default 'all', p_query text default '', p_page integer default 1)
returns table(id uuid, entity_type text, title_ru text, title_kk text, status text, deleted_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_smu_session();
  if not (public.has_permission('articles.delete') or public.has_permission('scientists.edit')) then raise exception 'forbidden'; end if;
  if p_kind is null or p_kind not in ('all', 'article', 'scientist') or p_query is null or length(p_query) > 120
    or p_page is null or p_page not between 1 and 10000 then raise exception 'invalid_input'; end if;
  if (p_kind = 'article' and not public.has_permission('articles.delete'))
    or (p_kind = 'scientist' and not public.has_permission('scientists.edit')) then raise exception 'forbidden'; end if;
  return query select d.* from (
    select a.id, 'article'::text entity_type, ru.title title_ru, kk.title title_kk, a.status::text status, a.deleted_at
    from public.articles a
    left join public.article_translations ru on ru.article_id = a.id and ru.locale = 'ru'
    left join public.article_translations kk on kk.article_id = a.id and kk.locale = 'kk'
    where a.deleted_at is not null and p_kind in ('all', 'article') and public.has_permission('articles.delete')
    union all
    select s.id, 'scientist', ru.full_name, kk.full_name, s.status::text, s.deleted_at
    from public.scientist_profiles s
    left join public.scientist_profile_translations ru on ru.scientist_profile_id = s.id and ru.locale = 'ru'
    left join public.scientist_profile_translations kk on kk.scientist_profile_id = s.id and kk.locale = 'kk'
    where s.deleted_at is not null and s.merged_into_id is null and p_kind in ('all', 'scientist') and public.has_permission('scientists.edit')
  ) d where p_query = '' or d.title_ru ilike '%' || p_query || '%' or d.title_kk ilike '%' || p_query || '%'
  order by d.deleted_at desc, d.entity_type, d.id limit 51 offset (p_page - 1) * 50;
end;
$$;
