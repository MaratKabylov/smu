-- Durable results, independent of the legacy free-text science_work results.
create type public.research_output_kind as enum
  ('dataset','report','map','atlas','methodology','recommendation','dashboard','software','archive');
create table public.research_outputs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  kind public.research_output_kind not null,
  status public.science_work_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  check (status <> 'published' or published_at is not null)
);
create table public.research_output_versions (
  output_id uuid not null references public.research_outputs(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key(output_id, version)
);
create table public.research_output_works (
  output_id uuid not null references public.research_outputs(id) on delete cascade,
  work_id uuid not null references public.science_works(id) on delete restrict,
  primary key(output_id, work_id)
);
create index research_output_works_work_idx on public.research_output_works(work_id);
create table public.research_output_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  file_name text not null check(length(file_name) between 1 and 255),
  mime_type text not null check(mime_type in ('application/pdf','text/csv','application/zip')),
  file_size integer not null check(file_size between 1 and 4194304),
  ready boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.research_output_files (
  output_id uuid not null,
  version integer not null,
  upload_id uuid not null references public.research_output_uploads(id) on delete restrict,
  is_public boolean not null default false,
  primary key(output_id,version,upload_id),
  foreign key(output_id,version) references public.research_output_versions(output_id,version) on delete cascade
);
-- Never expose the storage path through public metadata or direct Storage RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('result-files','result-files',false,4194304,array['application/pdf','text/csv','application/zip']);
insert into public.permissions(code,name) values
  ('outputs.create','Создание собственных научных результатов'),
  ('outputs.manage','Управление всеми научными результатами')
on conflict(code) do update set name=excluded.name;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (p.code='outputs.create' and r.code in ('author','scientist','scientist_manager','project_manager','admin','super_admin'))
   or (p.code='outputs.manage' and r.code in ('scientist_manager','project_manager','admin','super_admin'))
on conflict do nothing;
alter table public.research_outputs enable row level security;
alter table public.research_output_versions enable row level security;
alter table public.research_output_works enable row level security;
alter table public.research_output_uploads enable row level security;
alter table public.research_output_files enable row level security;
revoke all on public.research_outputs,public.research_output_versions,public.research_output_works,
  public.research_output_uploads,public.research_output_files from anon,authenticated;
grant select on public.research_outputs,public.research_output_versions,public.research_output_works,
  public.research_output_uploads,public.research_output_files to authenticated;
create policy outputs_read_owners on public.research_outputs for select to authenticated
using (owner_id=auth.uid() or public.has_permission('outputs.manage'));
create policy output_versions_read_owners on public.research_output_versions for select to authenticated
using(exists(select 1 from public.research_outputs o where o.id=output_id));
create policy output_works_read_owners on public.research_output_works for select to authenticated
using(exists(select 1 from public.research_outputs o where o.id=output_id));
create policy output_files_read_owners on public.research_output_files for select to authenticated
using(exists(select 1 from public.research_outputs o where o.id=output_id));
create policy output_uploads_read_self on public.research_output_uploads for select to authenticated
using(uploaded_by=auth.uid() or exists(select 1 from public.research_output_files f
  join public.research_outputs o on o.id=f.output_id where f.upload_id=research_output_uploads.id));

create function public.save_research_output(p_id uuid,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid(); v_id uuid; v_old public.research_outputs%rowtype;
  v_version integer; v_locale text; v_translation jsonb; v_snapshot jsonb;
  v_kind public.research_output_kind; v_status public.science_work_status;
begin
  if v_actor is null or not (public.has_permission('outputs.create') or public.has_permission('outputs.manage'))
    then raise exception 'forbidden'; end if;
  if p_id is not null then
    select * into v_old from public.research_outputs where id=p_id for update;
    if not found then raise exception 'not_found'; end if;
    if v_old.owner_id<>v_actor and not public.has_permission('outputs.manage') then raise exception 'forbidden'; end if;
    if nullif(p_input->>'expectedVersion','')::integer is distinct from v_old.version then raise exception 'stale_version'; end if;
  end if;
  if jsonb_typeof(p_input) is distinct from 'object'
    or (p_input->>'kind') is null or (p_input->>'kind') not in ('dataset','report','map','atlas','methodology','recommendation','dashboard','software','archive')
    or (p_input->>'status') is null or (p_input->>'status') not in ('draft','published','archived')
    or length(coalesce(p_input->>'versionLabel','')) not between 1 and 80
    or length(coalesce(p_input->>'license','')) not between 1 and 160
    or length(coalesce(p_input->>'changeNote',''))>2000
    or length(coalesce(p_input->>'externalUrl',''))>1000
    or (coalesce(p_input->>'externalUrl','')<>'' and (p_input->>'externalUrl') !~* '^https?://[^[:space:]]+$')
    or jsonb_typeof(p_input->'workIds') is distinct from 'array'
    or jsonb_array_length(p_input->'workIds') not between 1 and 20
    or jsonb_typeof(p_input->'files') is distinct from 'array'
    or jsonb_array_length(p_input->'files')>20 then raise exception 'invalid_input'; end if;
  v_kind:=(p_input->>'kind')::public.research_output_kind;
  v_status:=(p_input->>'status')::public.science_work_status;
  foreach v_locale in array array['ru','kk','en'] loop
    v_translation:=p_input->v_locale;
    if v_locale='en' and (v_translation is null or v_translation='null'::jsonb) then continue; end if;
    if jsonb_typeof(v_translation) is distinct from 'object'
      or length(trim(coalesce(v_translation->>'title',''))) not between 3 and 240
      or length(trim(coalesce(v_translation->>'description',''))) not between 20 and 20000
      then raise exception 'invalid_input'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements_text(p_input->'workIds'))<>jsonb_array_length(p_input->'workIds')
    or (select count(distinct f->>'id') from jsonb_array_elements(p_input->'files') f)<>jsonb_array_length(p_input->'files')
    or exists(select 1 from jsonb_array_elements(p_input->'files') f where jsonb_typeof(f->'isPublic') is distinct from 'boolean')
    then raise exception 'invalid_input'; end if;
  -- Lock referenced rows: state cannot change between validation and commit.
  perform w.id from public.science_works w where w.id in
    (select value::uuid from jsonb_array_elements_text(p_input->'workIds')) for share;
  if exists(select 1 from jsonb_array_elements_text(p_input->'workIds') i
    where not exists(select 1 from public.science_works w where w.id=i.value::uuid and w.deleted_at is null
      and (v_status<>'published' or (w.status='published' and w.published_at<=now()))
      and (public.has_permission('outputs.manage') or w.created_by=v_actor or
        exists(select 1 from public.science_work_members m join public.scientist_profiles s on s.id=m.scientist_id
          where m.work_id=w.id and s.user_id=v_actor and s.deleted_at is null)))) then raise exception 'invalid_reference'; end if;
  perform u.id from public.research_output_uploads u where u.id in
    (select (f->>'id')::uuid from jsonb_array_elements(p_input->'files') f) for share;
  if exists(select 1 from jsonb_array_elements(p_input->'files') f where not exists
    (select 1 from public.research_output_uploads u where u.id=(f->>'id')::uuid and u.ready and
      (u.uploaded_by=v_actor or exists(select 1 from public.research_output_files old_file
        where old_file.output_id=p_id and old_file.version=v_old.version and old_file.upload_id=u.id))))
    then raise exception 'invalid_reference'; end if;
  -- Whitelist fields; account IDs and arbitrary client payloads never enter snapshots.
  v_snapshot:=jsonb_build_object('kind',v_kind,'versionLabel',p_input->>'versionLabel','license',p_input->>'license',
    'changeNote',coalesce(p_input->>'changeNote',''),'externalUrl',coalesce(p_input->>'externalUrl',''),
    'workIds',p_input->'workIds','files',coalesce((select jsonb_agg(jsonb_build_object(
      'id',f->>'id','isPublic',(f->>'isPublic')::boolean)) from jsonb_array_elements(p_input->'files') f),'[]'::jsonb));
  foreach v_locale in array array['ru','kk','en'] loop
    if jsonb_typeof(p_input->v_locale)='object' then v_snapshot:=v_snapshot||jsonb_build_object(v_locale,
      jsonb_build_object('title',trim(p_input->v_locale->>'title'),'description',trim(p_input->v_locale->>'description'))); end if;
  end loop;
  if p_id is null then
    insert into public.research_outputs(owner_id,kind) values(v_actor,v_kind) returning id into v_id;
    v_version:=1;
  else v_id:=p_id; v_version:=v_old.version+1; end if;
  update public.research_outputs set kind=v_kind,status=v_status,version=v_version,updated_at=clock_timestamp(),
    published_at=case when v_status='published' then coalesce(v_old.published_at,now()) else null end where id=v_id;
  insert into public.research_output_versions(output_id,version,snapshot,created_by) values(v_id,v_version,v_snapshot,v_actor);
  delete from public.research_output_works where output_id=v_id;
  insert into public.research_output_works(output_id,work_id) select v_id,value::uuid from jsonb_array_elements_text(p_input->'workIds');
  insert into public.research_output_files(output_id,version,upload_id,is_public)
    select v_id,v_version,(f->>'id')::uuid,(f->>'isPublic')::boolean from jsonb_array_elements(p_input->'files') f;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
    values(v_actor,'research_output',v_id,case when p_id is null then 'output.create' else 'output.version' end,
      case when p_id is null then null else jsonb_build_object('version',v_old.version,'status',v_old.status) end,
      jsonb_build_object('version',v_version,'status',v_status));
  return v_id;
end $$;
revoke all on function public.save_research_output(uuid,jsonb) from public,anon,service_role;
grant execute on function public.save_research_output(uuid,jsonb) to authenticated;

create function public.research_output_work_options(p_query text default '',p_ids uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not (public.has_permission('outputs.create') or public.has_permission('outputs.manage')) then raise exception 'forbidden'; end if;
  if length(coalesce(p_query,''))>120 or coalesce(cardinality(p_ids),0)>20 then raise exception 'invalid_input'; end if;
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_result from (
    select jsonb_build_object('id',w.id,'kind',w.kind,'status',w.status,
      'title',coalesce(t.title,w.id::text)) item
    from public.science_works w left join public.science_work_translations t on t.work_id=w.id and t.locale='ru'
    where w.deleted_at is null and (p_ids is null or w.id=any(p_ids))
      and position(lower(coalesce(p_query,'')) in lower(coalesce(t.title,'')))>0
      and (public.has_permission('outputs.manage') or w.created_by=auth.uid() or
        exists(select 1 from public.science_work_members m join public.scientist_profiles s on s.id=m.scientist_id
          where m.work_id=w.id and s.user_id=auth.uid() and s.deleted_at is null))
    order by w.updated_at desc,w.id limit 50
  ) options;
  return v_result;
end $$;
revoke all on function public.research_output_work_options(text,uuid[]) from public,anon,service_role;
grant execute on function public.research_output_work_options(text,uuid[]) to authenticated;

create function public.list_public_research_outputs(p_locale text,p_work_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(item order by id),'[]'::jsonb) from (
    select o.id,jsonb_build_object('id',o.id,'kind',o.kind,'version',o.version,
      'versionLabel',v.snapshot->>'versionLabel','license',v.snapshot->>'license',
      'title',v.snapshot->p_locale->>'title','description',v.snapshot->p_locale->>'description',
      'externalUrl',v.snapshot->>'externalUrl','files',coalesce((select jsonb_agg(jsonb_build_object(
        'id',u.id,'name',u.file_name,'size',u.file_size,'mimeType',u.mime_type) order by u.file_name,u.id)
        from public.research_output_files f join public.research_output_uploads u on u.id=f.upload_id
        where f.output_id=o.id and f.version=o.version and f.is_public and u.ready),'[]'::jsonb)) item
    from public.research_outputs o join public.research_output_versions v on v.output_id=o.id and v.version=o.version
    join public.research_output_works r on r.output_id=o.id
    join public.science_works w on w.id=r.work_id
    where r.work_id=p_work_id and p_locale in ('ru','kk','en') and v.snapshot ? p_locale
      and o.status='published' and o.published_at<=now()
      and w.status='published' and w.published_at<=now() and w.deleted_at is null
      and exists(select 1 from public.science_work_translations t where t.work_id=w.id and t.locale=p_locale)
  ) visible;
$$;
revoke all on function public.list_public_research_outputs(text,uuid) from public,service_role;
grant execute on function public.list_public_research_outputs(text,uuid) to anon,authenticated;

-- Used fresh at download time, never cached. Only approved public attachments
-- or the owner/manager can receive a short-lived signed URL.
create function public.resolve_research_output_file(p_output_id uuid,p_version integer,p_upload_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('path',u.storage_path,'name',u.file_name)
  from public.research_outputs o join public.research_output_files f on f.output_id=o.id
    join public.research_output_uploads u on u.id=f.upload_id
  where o.id=p_output_id and f.version=p_version and f.upload_id=p_upload_id and u.ready
    and ((auth.uid() is not null and (o.owner_id=auth.uid() or public.has_permission('outputs.manage')))
      or (f.is_public and f.version=o.version and o.status='published' and o.published_at<=now()
        and exists(select 1 from public.research_output_works r join public.science_works w on w.id=r.work_id
          where r.output_id=o.id and w.status='published' and w.published_at<=now() and w.deleted_at is null)));
$$;
revoke all on function public.resolve_research_output_file(uuid,integer,uuid) from public,service_role;
grant execute on function public.resolve_research_output_file(uuid,integer,uuid) to anon,authenticated;
-- Registration is a trusted server operation after actual byte validation.
revoke all on public.research_output_uploads from service_role;
grant select,insert,update,delete on public.research_output_uploads to service_role;
