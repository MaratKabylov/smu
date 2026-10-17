-- Recovery of an interrupted/manual 035 run. Run the WHOLE file, as postgres.
-- Preserves rows/files. Reinstalls 035 functions and ACLs. Does not change migration history.
-- For the 035 schema only; do not use to roll back later migrations.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- 035 assigns permissions to existing roles; their definitions come from seed.sql.
do $prerequisites$
declare v_missing text;
begin
  select string_agg(r.code,', ' order by r.code) into v_missing
  from (values('admin'),('super_admin')) r(code)
  where not exists(select 1 from public.roles p where p.code=r.code);
  if v_missing is not null then
    raise exception '035 missing prerequisite roles: %. Apply supabase/seed.sql, then retry. No changes committed.',v_missing;
  end if;
end $prerequisites$;

-- Existing tables must have the exact 035 columns/defaults/constraints.
do $preflight$
declare v_failed text; v_tbl text;
begin
  foreach v_tbl in array array['support_requests','support_request_files'] loop
    if to_regclass('public.'||v_tbl) is not null then
      execute format('lock table public.%I in share row exclusive mode',v_tbl);
    end if;
  end loop;
  with expected as (select $smu035${"columns":[{"tbl":"support_request_files","cols":[["id","uuid",true,null,"",""],["request_id","uuid",true,null,"",""],["storage_path","text",true,null,"",""],["name","text",true,null,"",""],["size","integer",true,null,"",""],["mime_type","text",true,null,"",""]]},{"tbl":"support_requests","cols":[["id","uuid",true,null,"",""],["kind","text",true,null,"",""],["owner_id","uuid",false,null,"",""],["locale","text",true,null,"",""],["title","text",true,null,"",""],["description","text",true,null,"",""],["contact_name","text",true,null,"",""],["email","text",true,null,"",""],["organization","text",true,"''::text","",""],["details","jsonb",true,null,"",""],["consent_at","timestamp with time zone",true,"now()","",""],["consent_policy","text",true,"'support-v1'::text","",""],["status","text",true,"'new'::text","",""],["priority","text",true,"'normal'::text","",""],["assigned_to","uuid",false,null,"",""],["manager_note","text",true,"''::text","",""],["version","integer",true,"1","",""],["created_at","timestamp with time zone",true,"now()","",""],["updated_at","timestamp with time zone",true,"now()","",""]]}],"constraints":[{"tbl":"support_request_files","name":"support_request_files_mime_type_check","def":"CHECK ((mime_type = 'application/pdf'::text))"},{"tbl":"support_request_files","name":"support_request_files_name_check","def":"CHECK ((((length(name) >= 1) AND (length(name) <= 200)) AND (name !~ '[[:cntrl:]/\\\\]'::text)))"},{"tbl":"support_request_files","name":"support_request_files_pkey","def":"PRIMARY KEY (id)"},{"tbl":"support_request_files","name":"support_request_files_request_id_fkey","def":"FOREIGN KEY (request_id) REFERENCES support_requests(id) ON DELETE RESTRICT"},{"tbl":"support_request_files","name":"support_request_files_size_check","def":"CHECK (((size >= 1) AND (size <= 1048576)))"},{"tbl":"support_request_files","name":"support_request_files_storage_path_key","def":"UNIQUE (storage_path)"},{"tbl":"support_requests","name":"support_requests_assigned_to_fkey","def":"FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE RESTRICT"},{"tbl":"support_requests","name":"support_requests_kind_check","def":"CHECK ((kind = ANY (ARRAY['research_proposal'::text, 'it_request'::text, 'publication_support'::text])))"},{"tbl":"support_requests","name":"support_requests_locale_check","def":"CHECK ((locale = ANY (ARRAY['ru'::text, 'kk'::text, 'en'::text])))"},{"tbl":"support_requests","name":"support_requests_owner_id_fkey","def":"FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT"},{"tbl":"support_requests","name":"support_requests_pkey","def":"PRIMARY KEY (id)"},{"tbl":"support_requests","name":"support_requests_priority_check","def":"CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])))"},{"tbl":"support_requests","name":"support_requests_status_check","def":"CHECK ((status = ANY (ARRAY['new'::text, 'in_review'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text])))"},{"tbl":"support_requests","name":"support_requests_version_check","def":"CHECK ((version > 0))"}],"indexes":[{"name":"support_request_files_pkey","def":"CREATE UNIQUE INDEX support_request_files_pkey ON support_request_files USING btree (id)"},{"name":"support_request_files_storage_path_key","def":"CREATE UNIQUE INDEX support_request_files_storage_path_key ON support_request_files USING btree (storage_path)"},{"name":"support_requests_owner_idx","def":"CREATE INDEX support_requests_owner_idx ON support_requests USING btree (owner_id, updated_at DESC, id)"},{"name":"support_requests_pkey","def":"CREATE UNIQUE INDEX support_requests_pkey ON support_requests USING btree (id)"},{"name":"support_requests_queue_idx","def":"CREATE INDEX support_requests_queue_idx ON support_requests USING btree (kind, status, updated_at DESC, id)"},{"name":"support_requests_rate_idx","def":"CREATE INDEX support_requests_rate_idx ON support_requests USING btree (email, created_at)"}],"functions":[{"sig":"public.list_support_requests(text,text,integer,uuid,boolean)","body":"fbcf19e22e7c0e4435b7893e9a490f5e","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_kind","p_status","p_page","p_id","p_manage"],"defaults":4,"default_expr":"'all'::text, 1, NULL::uuid, false","lang":"plpgsql"},{"sig":"public.resolve_support_request_file(uuid,uuid)","body":"28f0c6590c14a9383f026ebc8044fadd","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_request","p_file"],"defaults":0,"default_expr":null,"lang":"plpgsql"},{"sig":"public.smu_can_manage_support(uuid,text)","body":"a8f5af0d49e5988251cab2734d26c32c","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"boolean","args":["p_actor","p_kind"],"defaults":0,"default_expr":null,"lang":"sql"},{"sig":"public.smu_support_permission(text)","body":"4c485641e79d24f305315144beb0b78d","sec":false,"vol":"i","config":["search_path=\"\""],"retset":false,"ret":"text","args":["p_kind"],"defaults":0,"default_expr":null,"lang":"sql"},{"sig":"public.submit_support_request(uuid,jsonb,jsonb,uuid)","body":"7ab4e7434c709f0c6a47b5755c107f81","sec":true,"vol":"v","config":["search_path=\"\""],"retset":false,"ret":"uuid","args":["p_id","p_input","p_files","p_owner"],"defaults":1,"default_expr":"NULL::uuid","lang":"plpgsql"},{"sig":"public.support_request_assignees(text)","body":"d96b8b5c886d41f058501d05979408c2","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_kind"],"defaults":0,"default_expr":null,"lang":"plpgsql"},{"sig":"public.update_support_request(uuid,integer,text,text,uuid,text)","body":"9c7046670fc695813ca02bedb396b987","sec":true,"vol":"v","config":["search_path=\"\""],"retset":false,"ret":"void","args":["p_id","p_version","p_status","p_priority","p_assigned_to","p_note"],"defaults":0,"default_expr":null,"lang":"plpgsql"}]}$smu035$::jsonb as data),
columns_expected as (select * from jsonb_to_recordset((select data->'columns' from expected)) as x(tbl text,cols jsonb)),
constraints_expected as (select * from jsonb_to_recordset((select data->'constraints' from expected)) as x(tbl text,name text,def text)),
indexes_expected as (select * from jsonb_to_recordset((select data->'indexes' from expected)) as x(name text,def text)),
functions_expected as (select * from jsonb_to_recordset((select data->'functions' from expected)) as x(sig text,body text,sec boolean,vol text,config text[],retset boolean,ret text,args text[],defaults integer,default_expr text,lang text)),
checks as (
 select 'columns:'||e.tbl as check_name,coalesce((select c.relkind='r' and
   (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
     pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)=e.cols
   from pg_class c where c.oid=to_regclass('public.'||e.tbl)),false) as ok from columns_expected e
 union all select 'constraint:'||e.name,exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||e.tbl)
   and c.conname=e.name and c.convalidated and replace(pg_get_constraintdef(c.oid),'public.','')=e.def) from constraints_expected e
 union all select 'index:'||e.name,exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.'||e.name)
   and i.indisvalid and i.indisready and replace(pg_get_indexdef(i.indexrelid),'public.','')=e.def) from indexes_expected e
 union all select 'rls:'||e.tbl,coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.'||e.tbl)),false) from columns_expected e
 union all select 'table_privileges:'||e.tbl,to_regclass('public.'||e.tbl) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
   where has_table_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(priv)
   where has_any_column_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) from columns_expected e
 union all select 'function:'||e.sig,exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(e.sig)
   and md5(replace(p.prosrc,chr(13),''))=e.body and p.prosecdef=e.sec and p.provolatile::text=e.vol
   and p.proconfig is not distinct from e.config and p.proretset=e.retset and format_type(p.prorettype,null)=e.ret
   and p.proargnames is not distinct from e.args and p.pronargdefaults=e.defaults
   and pg_get_expr(p.proargdefaults,0) is not distinct from e.default_expr and l.lanname=e.lang) from functions_expected e
 union all select 'function_privileges:'||e.sig,to_regprocedure(e.sig) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   where has_function_privilege(r.role_name,to_regprocedure(e.sig),'EXECUTE') is distinct from
    (case when e.sig like 'public.submit_support_request(%' then r.role_name='service_role'
      when e.sig like 'public.smu_%' then false else r.role_name='authenticated' end)) from functions_expected e
 union all select 'permission:'||p.code,exists(select 1 from public.permissions q where q.code=p.code)
   from (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'role:'||r.code,exists(select 1 from public.roles rr where rr.code=r.code)
   from (values('admin'),('super_admin')) r(code)
 union all select 'role_permission:'||r.code||':'||p.code,exists(select 1 from public.role_permissions rp
   join public.roles rr on rr.id=rp.role_id join public.permissions pp on pp.id=rp.permission_id where rr.code=r.code and pp.code=p.code)
   from (values('admin'),('super_admin')) r(code)
   cross join (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'storage_bucket',exists(select 1 from storage.buckets where id='support-request-files'
   and name='support-request-files' and public=false and file_size_limit=1048576 and allowed_mime_types=array['application/pdf']::text[])
)
  select string_agg(check_name,', ' order by check_name) into v_failed from checks
   where not ok and ((check_name like 'columns:%' and to_regclass('public.'||split_part(check_name,':',2)) is not null)
    or (check_name like 'constraint:%' and exists(select 1 from constraints_expected e where 'constraint:'||e.name=check_name and to_regclass('public.'||e.tbl) is not null)));
  if v_failed is not null then raise exception '035 incompatible existing schema: %. No changes committed.',v_failed; end if;
end $preflight$;

-- Shared operational workflow, with a separate permission for each request kind.
insert into public.permissions(code,name) values
 ('research_proposals.manage','Рассмотрение исследовательских предложений'),
 ('it_requests.manage','Обработка IT-заявок'),
 ('publication_support.manage','Поддержка публикаций') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('admin','super_admin') and p.code in ('research_proposals.manage','it_requests.manage','publication_support.manage') on conflict do nothing;

create table if not exists public.support_requests (
 id uuid primary key,
 kind text not null check(kind in ('research_proposal','it_request','publication_support')),
 owner_id uuid references public.profiles(id) on delete restrict,
 locale text not null check(locale in ('ru','kk','en')),
 title text not null,
 description text not null,
 contact_name text not null,
 email text not null,
 organization text not null default '',
 details jsonb not null,
 consent_at timestamptz not null default now(),
 consent_policy text not null default 'support-v1',
 status text not null default 'new' check(status in ('new','in_review','in_progress','completed','rejected')),
 priority text not null default 'normal' check(priority in ('low','normal','high')),
 assigned_to uuid references public.profiles(id) on delete restrict,
 manager_note text not null default '',
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists support_requests_queue_idx on public.support_requests(kind,status,updated_at desc,id);
create index if not exists support_requests_owner_idx on public.support_requests(owner_id,updated_at desc,id);
create index if not exists support_requests_rate_idx on public.support_requests(email,created_at);
create table if not exists public.support_request_files (
 id uuid primary key,
 request_id uuid not null references public.support_requests(id) on delete restrict,
 storage_path text not null unique,
 name text not null check(length(name) between 1 and 200 and name !~ '[[:cntrl:]/\\]'),
 size integer not null check(size between 1 and 1048576),
 mime_type text not null check(mime_type='application/pdf')
);
alter table public.support_requests enable row level security;
alter table public.support_request_files enable row level security;
revoke all on public.support_requests,public.support_request_files from public,anon,authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('support-request-files','support-request-files',false,1048576,array['application/pdf'])
on conflict(id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.smu_support_permission(p_kind text) returns text
 language sql immutable set search_path='' as $$ select case p_kind
 when 'research_proposal' then 'research_proposals.manage' when 'it_request' then 'it_requests.manage'
 when 'publication_support' then 'publication_support.manage' end $$;
create or replace function public.smu_can_manage_support(p_actor uuid,p_kind text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='admin.access')
 and exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code=public.smu_support_permission(p_kind))
 $$;
revoke all on function public.smu_support_permission(text),public.smu_can_manage_support(uuid,text) from public,anon,authenticated,service_role;

-- Trusted ingress only: owner identity and file metadata come from the server,
-- after Auth verification and byte inspection. No browser can call this RPC.
create or replace function public.submit_support_request(p_id uuid,p_input jsonb,p_files jsonb,p_owner uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_kind text:=p_input->>'kind'; v_email text:=lower(btrim(p_input->>'email'));
 v_keys text[]; v_key text; v_details jsonb:='{}'; v_file jsonb;
begin
 if p_id is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>150000
  or public.smu_support_permission(v_kind) is null or p_input->>'locale' is null or p_input->>'locale' not in ('ru','kk','en')
  or (p_input->'consent') is distinct from 'true'::jsonb then raise exception 'invalid_input'; end if;
 foreach v_key in array array['title','description','contactName','email','organization'] loop
  if jsonb_typeof(p_input->v_key) is distinct from 'string' then raise exception 'invalid_input'; end if;
 end loop;
 if length(btrim(p_input->>'title')) not between 3 and 200
  or length(btrim(p_input->>'description')) not between 20 and 20000
  or length(btrim(p_input->>'contactName')) not between 2 and 160
  or length(p_input->>'organization')>200 or length(v_email)>254
  or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or jsonb_typeof(p_input->'details') is distinct from 'object' then raise exception 'invalid_input'; end if;
 v_keys:=case v_kind when 'research_proposal' then array['importance','region','availableData']
  when 'it_request' then array['currentProcess','desiredSolution','dataDescription']
  else array['journal','manuscriptStage','supportNeeded'] end;
 foreach v_key in array v_keys loop
  if jsonb_typeof(p_input->'details'->v_key) is distinct from 'string'
    or length(btrim(p_input->'details'->>v_key)) not between 2 and 5000 then raise exception 'invalid_input'; end if;
  v_details:=v_details||jsonb_build_object(v_key,btrim(p_input->'details'->>v_key));
 end loop;
 if p_owner is not null and not exists(select 1 from auth.users u where u.id=p_owner
  and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false
  and lower(btrim(u.email))=v_email) then raise exception 'forbidden'; end if;
 if jsonb_typeof(p_files) is distinct from 'array' then raise exception 'invalid_input'; end if;
 if jsonb_array_length(p_files)>3 then raise exception 'invalid_input'; end if;
 -- Serialize the per-address limit, including simultaneous requests.
 perform pg_advisory_xact_lock(hashtextextended('support:'||v_email,0));
 if (select count(*) from public.support_requests where email=v_email and created_at>now()-interval '1 hour')>=3 then raise exception 'rate_limited'; end if;
 insert into public.support_requests(id,kind,owner_id,locale,title,description,contact_name,email,organization,details)
 values(p_id,v_kind,p_owner,p_input->>'locale',btrim(p_input->>'title'),btrim(p_input->>'description'),btrim(p_input->>'contactName'),v_email,btrim(p_input->>'organization'),v_details);
 for v_file in select value from jsonb_array_elements(p_files) loop
  if jsonb_typeof(v_file) is distinct from 'object' or v_file->>'id' is null
    or v_file->>'path' is distinct from p_id::text||'/'||(v_file->>'id')
    or jsonb_typeof(v_file->'name') is distinct from 'string' or v_file->>'name' !~* '\.pdf$'
    or v_file->>'mimeType' is distinct from 'application/pdf'
    or jsonb_typeof(v_file->'size') is distinct from 'number' then raise exception 'invalid_file'; end if;
  insert into public.support_request_files(id,request_id,storage_path,name,size,mime_type)
   values((v_file->>'id')::uuid,p_id,v_file->>'path',v_file->>'name',(v_file->>'size')::integer,v_file->>'mimeType');
 end loop;
 insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data)
 values(p_owner,'support_request',p_id,'submit',jsonb_build_object('kind',v_kind,'status','new','fileCount',jsonb_array_length(p_files),'policy','support-v1'));
 return p_id;
end $$;
revoke all on function public.submit_support_request(uuid,jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_support_request(uuid,jsonb,jsonb,uuid) to service_role;

create or replace function public.update_support_request(p_id uuid,p_version integer,p_status text,p_priority text,p_assigned_to uuid,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_old public.support_requests%rowtype;
begin
 select * into v_old from public.support_requests where id=p_id for update;
 if not found or not public.smu_can_manage_support(v_actor,v_old.kind) then raise exception 'forbidden'; end if;
 if p_status is null or p_status not in ('new','in_review','in_progress','completed','rejected') or p_priority is null
  or p_priority not in ('low','normal','high') or p_note is null or length(p_note)>5000 then raise exception 'invalid_input'; end if;
 if p_version is distinct from v_old.version then raise exception 'stale_version'; end if;
 if p_assigned_to is not null and (not public.smu_can_manage_support(p_assigned_to,v_old.kind) or not exists(select 1 from auth.users u where u.id=p_assigned_to
  and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false)) then raise exception 'invalid_assignee'; end if;
 if p_status<>v_old.status and not (case v_old.status
  when 'new' then p_status in ('in_review','rejected') when 'in_review' then p_status in ('in_progress','rejected')
  when 'in_progress' then p_status in ('in_review','completed','rejected')
  else p_status='in_review' end) then raise exception 'invalid_transition'; end if;
 if p_status=v_old.status and p_priority=v_old.priority and p_assigned_to is not distinct from v_old.assigned_to and btrim(p_note)=v_old.manager_note then return; end if;
 update public.support_requests set status=p_status,priority=p_priority,assigned_to=p_assigned_to,manager_note=btrim(p_note),version=version+1,updated_at=now() where id=p_id;
 insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data)
 values(v_actor,'support_request',p_id,'update',jsonb_build_object('status',v_old.status,'priority',v_old.priority,'assignedTo',v_old.assigned_to,'version',v_old.version),
  jsonb_build_object('status',p_status,'priority',p_priority,'assignedTo',p_assigned_to,'version',v_old.version+1,'noteChanged',btrim(p_note)<>v_old.manager_note));
end $$;
revoke all on function public.update_support_request(uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.update_support_request(uuid,integer,text,text,uuid,text) to authenticated;

create or replace function public.list_support_requests(p_kind text,p_status text default 'all',p_page integer default 1,p_id uuid default null,p_manage boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_result jsonb;
begin
 if public.smu_support_permission(p_kind) is null or p_status is null or p_status not in ('all','new','in_review','in_progress','completed','rejected')
  or p_page is null or p_page not between 1 and 100000 or p_manage is null then raise exception 'invalid_input'; end if;
 if p_manage and not public.smu_can_manage_support(v_actor,p_kind) then raise exception 'forbidden'; end if;
 with visible as (select * from public.support_requests r where r.kind=p_kind and (p_status='all' or r.status=p_status)
  and (p_id is null or r.id=p_id) and (p_manage or r.owner_id=v_actor)),
 page as (select * from visible order by updated_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('total',(select count(*) from visible),'page',p_page,'pageSize',20,'items',coalesce((
 select jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'locale',r.locale,'title',r.title,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at)
 || case when p_id is not null then jsonb_build_object('description',r.description,'details',r.details,'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',f.size) order by f.id) from public.support_request_files f where f.request_id=r.id),'[]'::jsonb)) else '{}'::jsonb end
 || case when p_manage then jsonb_build_object('version',r.version,'priority',r.priority,'assignedTo',r.assigned_to)
  || case when p_id is not null then jsonb_build_object('contactName',r.contact_name,'email',r.email,'organization',r.organization,'managerNote',r.manager_note) else '{}'::jsonb end
 else '{}'::jsonb end order by r.updated_at desc,r.id) from page r),'[]'::jsonb)) into v_result;
 return v_result;
end $$;
revoke all on function public.list_support_requests(text,text,integer,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.list_support_requests(text,text,integer,uuid,boolean) to authenticated;

create or replace function public.support_request_assignees(p_kind text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_result jsonb;
begin
 if not public.smu_can_manage_support(v_actor,p_kind) then raise exception 'forbidden'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(p.display_name,''),p.id::text)) order by p.display_name,p.id),'[]'::jsonb) into v_result
 from public.profiles p join auth.users u on u.id=p.id where public.smu_can_manage_support(p.id,p_kind)
  and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false;
 return v_result;
end $$;
revoke all on function public.support_request_assignees(text) from public,anon,authenticated,service_role;
grant execute on function public.support_request_assignees(text) to authenticated;

create or replace function public.resolve_support_request_file(p_request uuid,p_file uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_result jsonb;
begin
 select jsonb_build_object('path',f.storage_path,'name',f.name) into v_result
 from public.support_request_files f join public.support_requests r on r.id=f.request_id
 where r.id=p_request and f.id=p_file and (r.owner_id=v_actor or public.smu_can_manage_support(v_actor,r.kind));
 return v_result;
end $$;
revoke all on function public.resolve_support_request_file(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.resolve_support_request_file(uuid,uuid) to authenticated;


-- Do not commit unless all schema, definitions, ACLs and bucket checks pass.
do $verification$
declare v_failed text;
begin
  with expected as (select $smu035${"columns":[{"tbl":"support_request_files","cols":[["id","uuid",true,null,"",""],["request_id","uuid",true,null,"",""],["storage_path","text",true,null,"",""],["name","text",true,null,"",""],["size","integer",true,null,"",""],["mime_type","text",true,null,"",""]]},{"tbl":"support_requests","cols":[["id","uuid",true,null,"",""],["kind","text",true,null,"",""],["owner_id","uuid",false,null,"",""],["locale","text",true,null,"",""],["title","text",true,null,"",""],["description","text",true,null,"",""],["contact_name","text",true,null,"",""],["email","text",true,null,"",""],["organization","text",true,"''::text","",""],["details","jsonb",true,null,"",""],["consent_at","timestamp with time zone",true,"now()","",""],["consent_policy","text",true,"'support-v1'::text","",""],["status","text",true,"'new'::text","",""],["priority","text",true,"'normal'::text","",""],["assigned_to","uuid",false,null,"",""],["manager_note","text",true,"''::text","",""],["version","integer",true,"1","",""],["created_at","timestamp with time zone",true,"now()","",""],["updated_at","timestamp with time zone",true,"now()","",""]]}],"constraints":[{"tbl":"support_request_files","name":"support_request_files_mime_type_check","def":"CHECK ((mime_type = 'application/pdf'::text))"},{"tbl":"support_request_files","name":"support_request_files_name_check","def":"CHECK ((((length(name) >= 1) AND (length(name) <= 200)) AND (name !~ '[[:cntrl:]/\\\\]'::text)))"},{"tbl":"support_request_files","name":"support_request_files_pkey","def":"PRIMARY KEY (id)"},{"tbl":"support_request_files","name":"support_request_files_request_id_fkey","def":"FOREIGN KEY (request_id) REFERENCES support_requests(id) ON DELETE RESTRICT"},{"tbl":"support_request_files","name":"support_request_files_size_check","def":"CHECK (((size >= 1) AND (size <= 1048576)))"},{"tbl":"support_request_files","name":"support_request_files_storage_path_key","def":"UNIQUE (storage_path)"},{"tbl":"support_requests","name":"support_requests_assigned_to_fkey","def":"FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE RESTRICT"},{"tbl":"support_requests","name":"support_requests_kind_check","def":"CHECK ((kind = ANY (ARRAY['research_proposal'::text, 'it_request'::text, 'publication_support'::text])))"},{"tbl":"support_requests","name":"support_requests_locale_check","def":"CHECK ((locale = ANY (ARRAY['ru'::text, 'kk'::text, 'en'::text])))"},{"tbl":"support_requests","name":"support_requests_owner_id_fkey","def":"FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT"},{"tbl":"support_requests","name":"support_requests_pkey","def":"PRIMARY KEY (id)"},{"tbl":"support_requests","name":"support_requests_priority_check","def":"CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])))"},{"tbl":"support_requests","name":"support_requests_status_check","def":"CHECK ((status = ANY (ARRAY['new'::text, 'in_review'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text])))"},{"tbl":"support_requests","name":"support_requests_version_check","def":"CHECK ((version > 0))"}],"indexes":[{"name":"support_request_files_pkey","def":"CREATE UNIQUE INDEX support_request_files_pkey ON support_request_files USING btree (id)"},{"name":"support_request_files_storage_path_key","def":"CREATE UNIQUE INDEX support_request_files_storage_path_key ON support_request_files USING btree (storage_path)"},{"name":"support_requests_owner_idx","def":"CREATE INDEX support_requests_owner_idx ON support_requests USING btree (owner_id, updated_at DESC, id)"},{"name":"support_requests_pkey","def":"CREATE UNIQUE INDEX support_requests_pkey ON support_requests USING btree (id)"},{"name":"support_requests_queue_idx","def":"CREATE INDEX support_requests_queue_idx ON support_requests USING btree (kind, status, updated_at DESC, id)"},{"name":"support_requests_rate_idx","def":"CREATE INDEX support_requests_rate_idx ON support_requests USING btree (email, created_at)"}],"functions":[{"sig":"public.list_support_requests(text,text,integer,uuid,boolean)","body":"fbcf19e22e7c0e4435b7893e9a490f5e","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_kind","p_status","p_page","p_id","p_manage"],"defaults":4,"default_expr":"'all'::text, 1, NULL::uuid, false","lang":"plpgsql"},{"sig":"public.resolve_support_request_file(uuid,uuid)","body":"28f0c6590c14a9383f026ebc8044fadd","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_request","p_file"],"defaults":0,"default_expr":null,"lang":"plpgsql"},{"sig":"public.smu_can_manage_support(uuid,text)","body":"a8f5af0d49e5988251cab2734d26c32c","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"boolean","args":["p_actor","p_kind"],"defaults":0,"default_expr":null,"lang":"sql"},{"sig":"public.smu_support_permission(text)","body":"4c485641e79d24f305315144beb0b78d","sec":false,"vol":"i","config":["search_path=\"\""],"retset":false,"ret":"text","args":["p_kind"],"defaults":0,"default_expr":null,"lang":"sql"},{"sig":"public.submit_support_request(uuid,jsonb,jsonb,uuid)","body":"7ab4e7434c709f0c6a47b5755c107f81","sec":true,"vol":"v","config":["search_path=\"\""],"retset":false,"ret":"uuid","args":["p_id","p_input","p_files","p_owner"],"defaults":1,"default_expr":"NULL::uuid","lang":"plpgsql"},{"sig":"public.support_request_assignees(text)","body":"d96b8b5c886d41f058501d05979408c2","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_kind"],"defaults":0,"default_expr":null,"lang":"plpgsql"},{"sig":"public.update_support_request(uuid,integer,text,text,uuid,text)","body":"9c7046670fc695813ca02bedb396b987","sec":true,"vol":"v","config":["search_path=\"\""],"retset":false,"ret":"void","args":["p_id","p_version","p_status","p_priority","p_assigned_to","p_note"],"defaults":0,"default_expr":null,"lang":"plpgsql"}]}$smu035$::jsonb as data),
columns_expected as (select * from jsonb_to_recordset((select data->'columns' from expected)) as x(tbl text,cols jsonb)),
constraints_expected as (select * from jsonb_to_recordset((select data->'constraints' from expected)) as x(tbl text,name text,def text)),
indexes_expected as (select * from jsonb_to_recordset((select data->'indexes' from expected)) as x(name text,def text)),
functions_expected as (select * from jsonb_to_recordset((select data->'functions' from expected)) as x(sig text,body text,sec boolean,vol text,config text[],retset boolean,ret text,args text[],defaults integer,default_expr text,lang text)),
checks as (
 select 'columns:'||e.tbl as check_name,coalesce((select c.relkind='r' and
   (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
     pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)=e.cols
   from pg_class c where c.oid=to_regclass('public.'||e.tbl)),false) as ok from columns_expected e
 union all select 'constraint:'||e.name,exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||e.tbl)
   and c.conname=e.name and c.convalidated and replace(pg_get_constraintdef(c.oid),'public.','')=e.def) from constraints_expected e
 union all select 'index:'||e.name,exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.'||e.name)
   and i.indisvalid and i.indisready and replace(pg_get_indexdef(i.indexrelid),'public.','')=e.def) from indexes_expected e
 union all select 'rls:'||e.tbl,coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.'||e.tbl)),false) from columns_expected e
 union all select 'table_privileges:'||e.tbl,to_regclass('public.'||e.tbl) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
   where has_table_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(priv)
   where has_any_column_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) from columns_expected e
 union all select 'function:'||e.sig,exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(e.sig)
   and md5(replace(p.prosrc,chr(13),''))=e.body and p.prosecdef=e.sec and p.provolatile::text=e.vol
   and p.proconfig is not distinct from e.config and p.proretset=e.retset and format_type(p.prorettype,null)=e.ret
   and p.proargnames is not distinct from e.args and p.pronargdefaults=e.defaults
   and pg_get_expr(p.proargdefaults,0) is not distinct from e.default_expr and l.lanname=e.lang) from functions_expected e
 union all select 'function_privileges:'||e.sig,to_regprocedure(e.sig) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   where has_function_privilege(r.role_name,to_regprocedure(e.sig),'EXECUTE') is distinct from
    (case when e.sig like 'public.submit_support_request(%' then r.role_name='service_role'
      when e.sig like 'public.smu_%' then false else r.role_name='authenticated' end)) from functions_expected e
 union all select 'permission:'||p.code,exists(select 1 from public.permissions q where q.code=p.code)
   from (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'role:'||r.code,exists(select 1 from public.roles rr where rr.code=r.code)
   from (values('admin'),('super_admin')) r(code)
 union all select 'role_permission:'||r.code||':'||p.code,exists(select 1 from public.role_permissions rp
   join public.roles rr on rr.id=rp.role_id join public.permissions pp on pp.id=rp.permission_id where rr.code=r.code and pp.code=p.code)
   from (values('admin'),('super_admin')) r(code)
   cross join (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'storage_bucket',exists(select 1 from storage.buckets where id='support-request-files'
   and name='support-request-files' and public=false and file_size_limit=1048576 and allowed_mime_types=array['application/pdf']::text[])
)
select string_agg(check_name,', ' order by check_name) into v_failed from checks where not ok
;
  if v_failed is not null then raise exception '035 verification failed: %. No changes committed.',v_failed; end if;
end $verification$;
notify pgrst, 'reload schema';
commit;
with expected as (select $smu035${"columns":[{"tbl":"support_request_files","cols":[["id","uuid",true,null,"",""],["request_id","uuid",true,null,"",""],["storage_path","text",true,null,"",""],["name","text",true,null,"",""],["size","integer",true,null,"",""],["mime_type","text",true,null,"",""]]},{"tbl":"support_requests","cols":[["id","uuid",true,null,"",""],["kind","text",true,null,"",""],["owner_id","uuid",false,null,"",""],["locale","text",true,null,"",""],["title","text",true,null,"",""],["description","text",true,null,"",""],["contact_name","text",true,null,"",""],["email","text",true,null,"",""],["organization","text",true,"''::text","",""],["details","jsonb",true,null,"",""],["consent_at","timestamp with time zone",true,"now()","",""],["consent_policy","text",true,"'support-v1'::text","",""],["status","text",true,"'new'::text","",""],["priority","text",true,"'normal'::text","",""],["assigned_to","uuid",false,null,"",""],["manager_note","text",true,"''::text","",""],["version","integer",true,"1","",""],["created_at","timestamp with time zone",true,"now()","",""],["updated_at","timestamp with time zone",true,"now()","",""]]}],"constraints":[{"tbl":"support_request_files","name":"support_request_files_mime_type_check","def":"CHECK ((mime_type = 'application/pdf'::text))"},{"tbl":"support_request_files","name":"support_request_files_name_check","def":"CHECK ((((length(name) >= 1) AND (length(name) <= 200)) AND (name !~ '[[:cntrl:]/\\\\]'::text)))"},{"tbl":"support_request_files","name":"support_request_files_pkey","def":"PRIMARY KEY (id)"},{"tbl":"support_request_files","name":"support_request_files_request_id_fkey","def":"FOREIGN KEY (request_id) REFERENCES support_requests(id) ON DELETE RESTRICT"},{"tbl":"support_request_files","name":"support_request_files_size_check","def":"CHECK (((size >= 1) AND (size <= 1048576)))"},{"tbl":"support_request_files","name":"support_request_files_storage_path_key","def":"UNIQUE (storage_path)"},{"tbl":"support_requests","name":"support_requests_assigned_to_fkey","def":"FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE RESTRICT"},{"tbl":"support_requests","name":"support_requests_kind_check","def":"CHECK ((kind = ANY (ARRAY['research_proposal'::text, 'it_request'::text, 'publication_support'::text])))"},{"tbl":"support_requests","name":"support_requests_locale_check","def":"CHECK ((locale = ANY (ARRAY['ru'::text, 'kk'::text, 'en'::text])))"},{"tbl":"support_requests","name":"support_requests_owner_id_fkey","def":"FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT"},{"tbl":"support_requests","name":"support_requests_pkey","def":"PRIMARY KEY (id)"},{"tbl":"support_requests","name":"support_requests_priority_check","def":"CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])))"},{"tbl":"support_requests","name":"support_requests_status_check","def":"CHECK ((status = ANY (ARRAY['new'::text, 'in_review'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text])))"},{"tbl":"support_requests","name":"support_requests_version_check","def":"CHECK ((version > 0))"}],"indexes":[{"name":"support_request_files_pkey","def":"CREATE UNIQUE INDEX support_request_files_pkey ON support_request_files USING btree (id)"},{"name":"support_request_files_storage_path_key","def":"CREATE UNIQUE INDEX support_request_files_storage_path_key ON support_request_files USING btree (storage_path)"},{"name":"support_requests_owner_idx","def":"CREATE INDEX support_requests_owner_idx ON support_requests USING btree (owner_id, updated_at DESC, id)"},{"name":"support_requests_pkey","def":"CREATE UNIQUE INDEX support_requests_pkey ON support_requests USING btree (id)"},{"name":"support_requests_queue_idx","def":"CREATE INDEX support_requests_queue_idx ON support_requests USING btree (kind, status, updated_at DESC, id)"},{"name":"support_requests_rate_idx","def":"CREATE INDEX support_requests_rate_idx ON support_requests USING btree (email, created_at)"}],"functions":[{"sig":"public.list_support_requests(text,text,integer,uuid,boolean)","body":"fbcf19e22e7c0e4435b7893e9a490f5e","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_kind","p_status","p_page","p_id","p_manage"],"defaults":4,"default_expr":"'all'::text, 1, NULL::uuid, false","lang":"plpgsql"},{"sig":"public.resolve_support_request_file(uuid,uuid)","body":"28f0c6590c14a9383f026ebc8044fadd","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_request","p_file"],"defaults":0,"default_expr":null,"lang":"plpgsql"},{"sig":"public.smu_can_manage_support(uuid,text)","body":"a8f5af0d49e5988251cab2734d26c32c","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"boolean","args":["p_actor","p_kind"],"defaults":0,"default_expr":null,"lang":"sql"},{"sig":"public.smu_support_permission(text)","body":"4c485641e79d24f305315144beb0b78d","sec":false,"vol":"i","config":["search_path=\"\""],"retset":false,"ret":"text","args":["p_kind"],"defaults":0,"default_expr":null,"lang":"sql"},{"sig":"public.submit_support_request(uuid,jsonb,jsonb,uuid)","body":"7ab4e7434c709f0c6a47b5755c107f81","sec":true,"vol":"v","config":["search_path=\"\""],"retset":false,"ret":"uuid","args":["p_id","p_input","p_files","p_owner"],"defaults":1,"default_expr":"NULL::uuid","lang":"plpgsql"},{"sig":"public.support_request_assignees(text)","body":"d96b8b5c886d41f058501d05979408c2","sec":true,"vol":"s","config":["search_path=\"\""],"retset":false,"ret":"jsonb","args":["p_kind"],"defaults":0,"default_expr":null,"lang":"plpgsql"},{"sig":"public.update_support_request(uuid,integer,text,text,uuid,text)","body":"9c7046670fc695813ca02bedb396b987","sec":true,"vol":"v","config":["search_path=\"\""],"retset":false,"ret":"void","args":["p_id","p_version","p_status","p_priority","p_assigned_to","p_note"],"defaults":0,"default_expr":null,"lang":"plpgsql"}]}$smu035$::jsonb as data),
columns_expected as (select * from jsonb_to_recordset((select data->'columns' from expected)) as x(tbl text,cols jsonb)),
constraints_expected as (select * from jsonb_to_recordset((select data->'constraints' from expected)) as x(tbl text,name text,def text)),
indexes_expected as (select * from jsonb_to_recordset((select data->'indexes' from expected)) as x(name text,def text)),
functions_expected as (select * from jsonb_to_recordset((select data->'functions' from expected)) as x(sig text,body text,sec boolean,vol text,config text[],retset boolean,ret text,args text[],defaults integer,default_expr text,lang text)),
checks as (
 select 'columns:'||e.tbl as check_name,coalesce((select c.relkind='r' and
   (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
     pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)=e.cols
   from pg_class c where c.oid=to_regclass('public.'||e.tbl)),false) as ok from columns_expected e
 union all select 'constraint:'||e.name,exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||e.tbl)
   and c.conname=e.name and c.convalidated and replace(pg_get_constraintdef(c.oid),'public.','')=e.def) from constraints_expected e
 union all select 'index:'||e.name,exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.'||e.name)
   and i.indisvalid and i.indisready and replace(pg_get_indexdef(i.indexrelid),'public.','')=e.def) from indexes_expected e
 union all select 'rls:'||e.tbl,coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.'||e.tbl)),false) from columns_expected e
 union all select 'table_privileges:'||e.tbl,to_regclass('public.'||e.tbl) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
   where has_table_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(priv)
   where has_any_column_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) from columns_expected e
 union all select 'function:'||e.sig,exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(e.sig)
   and md5(replace(p.prosrc,chr(13),''))=e.body and p.prosecdef=e.sec and p.provolatile::text=e.vol
   and p.proconfig is not distinct from e.config and p.proretset=e.retset and format_type(p.prorettype,null)=e.ret
   and p.proargnames is not distinct from e.args and p.pronargdefaults=e.defaults
   and pg_get_expr(p.proargdefaults,0) is not distinct from e.default_expr and l.lanname=e.lang) from functions_expected e
 union all select 'function_privileges:'||e.sig,to_regprocedure(e.sig) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   where has_function_privilege(r.role_name,to_regprocedure(e.sig),'EXECUTE') is distinct from
    (case when e.sig like 'public.submit_support_request(%' then r.role_name='service_role'
      when e.sig like 'public.smu_%' then false else r.role_name='authenticated' end)) from functions_expected e
 union all select 'permission:'||p.code,exists(select 1 from public.permissions q where q.code=p.code)
   from (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'role:'||r.code,exists(select 1 from public.roles rr where rr.code=r.code)
   from (values('admin'),('super_admin')) r(code)
 union all select 'role_permission:'||r.code||':'||p.code,exists(select 1 from public.role_permissions rp
   join public.roles rr on rr.id=rp.role_id join public.permissions pp on pp.id=rp.permission_id where rr.code=r.code and pp.code=p.code)
   from (values('admin'),('super_admin')) r(code)
   cross join (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'storage_bucket',exists(select 1 from storage.buckets where id='support-request-files'
   and name='support-request-files' and public=false and file_size_limit=1048576 and allowed_mime_types=array['application/pdf']::text[])
)
select check_name,ok from checks order by ok,check_name;
