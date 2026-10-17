-- Shared operational workflow, with a separate permission for each request kind.
insert into public.permissions(code,name) values
 ('research_proposals.manage','Рассмотрение исследовательских предложений'),
 ('it_requests.manage','Обработка IT-заявок'),
 ('publication_support.manage','Поддержка публикаций') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('admin','super_admin') and p.code in ('research_proposals.manage','it_requests.manage','publication_support.manage') on conflict do nothing;

create table public.support_requests (
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
create index support_requests_queue_idx on public.support_requests(kind,status,updated_at desc,id);
create index support_requests_owner_idx on public.support_requests(owner_id,updated_at desc,id);
create index support_requests_rate_idx on public.support_requests(email,created_at);
create table public.support_request_files (
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
 values('support-request-files','support-request-files',false,1048576,array['application/pdf']);

create function public.smu_support_permission(p_kind text) returns text
 language sql immutable set search_path='' as $$ select case p_kind
 when 'research_proposal' then 'research_proposals.manage' when 'it_request' then 'it_requests.manage'
 when 'publication_support' then 'publication_support.manage' end $$;
create function public.smu_can_manage_support(p_actor uuid,p_kind text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='admin.access')
 and exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code=public.smu_support_permission(p_kind))
 $$;
revoke all on function public.smu_support_permission(text),public.smu_can_manage_support(uuid,text) from public,anon,authenticated,service_role;

-- Trusted ingress only: owner identity and file metadata come from the server,
-- after Auth verification and byte inspection. No browser can call this RPC.
create function public.submit_support_request(p_id uuid,p_input jsonb,p_files jsonb,p_owner uuid default null) returns uuid
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

create function public.update_support_request(p_id uuid,p_version integer,p_status text,p_priority text,p_assigned_to uuid,p_note text) returns void
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

create function public.list_support_requests(p_kind text,p_status text default 'all',p_page integer default 1,p_id uuid default null,p_manage boolean default false) returns jsonb
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

create function public.support_request_assignees(p_kind text) returns jsonb
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

create function public.resolve_support_request_file(p_request uuid,p_file uuid) returns jsonb
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
