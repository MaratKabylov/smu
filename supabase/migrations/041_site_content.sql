-- Fixed information templates and homepage slots, never executable markup or a page builder.
begin;

insert into public.permissions(code,name) values ('content.manage','Управление страницами и главной') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('content_manager','admin','super_admin') and p.code='content.manage' on conflict do nothing;

create table public.content_pages (
  key text primary key check(key in ('about','foundation','team','partners','documents','contacts','research_program','it_support','publication_support')),
  template text not null check(template in ('standard','landing','program','support')),
  status text not null default 'draft' check(status in ('draft','published')),
  version integer not null default 0 check(version>=0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.content_page_translations (
  page_key text not null references public.content_pages(key) on delete cascade,
  locale text not null check(locale in ('ru','kk','en')),
  title text not null check(length(title) between 1 and 200),
  summary text not null default '' check(length(summary)<=600),
  body text not null check(length(body) between 1 and 30000),
  cta_label text not null default '' check(length(cta_label)<=80),
  cta_href text not null default '' check(length(cta_href)<=500),
  primary key(page_key,locale)
);
create table public.homepage_sections (
  key text primary key check(key in ('hero','featured_research','featured_scientists','research_program','mentorship','scientist_support','latest_articles','opportunities','events','results','partners')),
  enabled boolean not null default false,
  sort_order integer not null check(sort_order between 0 and 100),
  display_limit integer not null default 3 check(display_limit between 1 and 12),
  titles jsonb not null default '{}' check(jsonb_typeof(titles)='object'),
  version integer not null default 0 check(version>=0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.app_settings (
  key text primary key check(key in ('site_name','contact_email','social_links')),
  value jsonb not null,
  version integer not null default 0 check(version>=0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.content_pages(key,template) values
 ('about','standard'),('foundation','landing'),('team','standard'),('partners','standard'),('documents','standard'),
 ('contacts','standard'),('research_program','program'),('it_support','support'),('publication_support','support');
insert into public.homepage_sections(key,sort_order)
select key,(ordinality-1)::integer from unnest(array['hero','featured_research','featured_scientists','research_program','mentorship','scientist_support','latest_articles','opportunities','events','results','partners']) with ordinality t(key,ordinality);
insert into public.app_settings(key,value) values ('site_name','"СМУ"'),('contact_email','""'),('social_links','[]');

alter table public.content_pages enable row level security;
alter table public.content_page_translations enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.app_settings enable row level security;
revoke all on public.content_pages,public.content_page_translations,public.homepage_sections,public.app_settings from public,anon,authenticated,service_role;

create function public.valid_content_href(p_href text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(length(p_href)<=500 and (p_href ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]\\<>]*)?$'
   or (p_href ~ '^/[A-Za-z0-9/_?=&.#-]*$' and p_href !~ '^//')),false)
$$;
revoke all on function public.valid_content_href(text) from public,anon,authenticated,service_role;

create function public.list_site_content() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_smu_session();
 if not public.has_permission('content.manage') and not public.has_permission('settings.manage') then raise exception 'forbidden'; end if;
 return jsonb_build_object(
  'pages',case when public.has_permission('content.manage') then (select jsonb_agg(to_jsonb(p)-'updated_by' || jsonb_build_object('translations',coalesce((select jsonb_agg(to_jsonb(t)-'page_key' order by t.locale) from public.content_page_translations t where t.page_key=p.key),'[]')) order by p.key) from public.content_pages p) else '[]'::jsonb end,
  'sections',case when public.has_permission('content.manage') then (select jsonb_agg(to_jsonb(s)-'updated_by' order by sort_order,key) from public.homepage_sections s) else '[]'::jsonb end,
  'settings',case when public.has_permission('settings.manage') then (select jsonb_agg(to_jsonb(s)-'updated_by' order by key) from public.app_settings s) else '[]'::jsonb end);
end;
$$;

create function public.save_site_content(p_kind text,p_key text,p_expected_version integer,p_data jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_version integer; v_t jsonb; v_locale text; v_value jsonb;
begin
 -- Synchronize permission revocation with all mutations, including after a lock wait.
 lock table public.user_roles,public.role_permissions in share mode;
 v_actor:=public.require_smu_session();
 if p_kind is null or p_kind not in ('page','section','setting') or p_key is null or p_expected_version is null
   or p_expected_version<0 or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>120000 then raise exception 'invalid_input'; end if;
 if not public.has_permission(case when p_kind='setting' then 'settings.manage' else 'content.manage' end) then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('smu_content:'||p_kind||':'||p_key,0));
 if p_kind='page' then
  select version into v_version from public.content_pages where key=p_key for update;
 elsif p_kind='section' then
  select version into v_version from public.homepage_sections where key=p_key for update;
 else
  select version into v_version from public.app_settings where key=p_key for update;
 end if;
 if v_version is null then raise exception 'not_found'; end if;
 if v_version<>p_expected_version then raise exception 'stale_version'; end if;
 if p_kind='page' then
  if (p_data - array['status','translations'])<>'{}'::jsonb or p_data->>'status' is null or p_data->>'status' not in ('draft','published')
    or jsonb_typeof(p_data->'translations') is distinct from 'array' or jsonb_array_length(p_data->'translations') not between 1 and 3 then raise exception 'invalid_input'; end if;
  if (select count(distinct x->>'locale') from jsonb_array_elements(p_data->'translations') x)<>jsonb_array_length(p_data->'translations') then raise exception 'invalid_input'; end if;
  for v_t in select value from jsonb_array_elements(p_data->'translations') loop
   v_locale:=v_t->>'locale';
   if jsonb_typeof(v_t) is distinct from 'object' or (v_t-array['locale','title','summary','body','cta_label','cta_href'])<>'{}'::jsonb
     or v_locale is null or v_locale not in ('ru','kk','en') then raise exception 'invalid_input'; end if;
   if exists(select 1 from unnest(array['title','summary','body','cta_label','cta_href']) k where jsonb_typeof(v_t->k) is distinct from 'string')
     or length(btrim(v_t->>'title')) not between 1 and 200 or length(v_t->>'summary')>600
     or length(btrim(v_t->>'body')) not between 1 and 30000 or length(v_t->>'cta_label')>80
     or ((v_t->>'cta_label'='')<>(v_t->>'cta_href'=''))
     or (v_t->>'cta_href'<>'' and not public.valid_content_href(v_t->>'cta_href')) then raise exception 'invalid_input'; end if;
  end loop;
  if p_data->>'status'='published' and not (p_data->'translations' @> '[{"locale":"ru"}]' and p_data->'translations' @> '[{"locale":"kk"}]') then raise exception 'invalid_input'; end if;
  delete from public.content_page_translations where page_key=p_key;
  insert into public.content_page_translations(page_key,locale,title,summary,body,cta_label,cta_href)
   select p_key,x->>'locale',btrim(x->>'title'),x->>'summary',btrim(x->>'body'),x->>'cta_label',x->>'cta_href' from jsonb_array_elements(p_data->'translations') x;
  update public.content_pages set status=p_data->>'status',version=version+1,updated_by=v_actor,updated_at=clock_timestamp() where key=p_key;
 elsif p_kind='section' then
  if (p_data-array['enabled','sort_order','display_limit','titles'])<>'{}'::jsonb or jsonb_typeof(p_data->'enabled') is distinct from 'boolean'
   or jsonb_typeof(p_data->'sort_order') is distinct from 'number' or jsonb_typeof(p_data->'display_limit') is distinct from 'number'
   or coalesce(p_data->>'sort_order','')!~ '^(0|[1-9][0-9]?)$|^100$' or coalesce(p_data->>'display_limit','')!~ '^([1-9]|1[0-2])$'
   or jsonb_typeof(p_data->'titles') is distinct from 'object' or ((p_data->'titles')-array['ru','kk','en'])<>'{}'::jsonb then raise exception 'invalid_input'; end if;
  if exists(select 1 from jsonb_each(p_data->'titles') where jsonb_typeof(value)<>'string' or length(value#>>'{}')>200) then raise exception 'invalid_input'; end if;
  update public.homepage_sections set enabled=(p_data->>'enabled')::boolean,sort_order=(p_data->>'sort_order')::integer,
   display_limit=(p_data->>'display_limit')::integer,titles=p_data->'titles',version=version+1,updated_by=v_actor,updated_at=clock_timestamp() where key=p_key;
 else
  v_value:=p_data->'value';
  if (p_data-'value')<>'{}'::jsonb or v_value is null then raise exception 'invalid_input'; end if;
  if p_key='site_name' then
   if jsonb_typeof(v_value)<>'string' or length(btrim(v_value#>>'{}')) not between 1 and 120 then raise exception 'invalid_input'; end if;
  elsif p_key='contact_email' then
   if jsonb_typeof(v_value)<>'string' or length(v_value#>>'{}')>254 or ((v_value#>>'{}')<>'' and (v_value#>>'{}')!~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') then raise exception 'invalid_input'; end if;
  else
   if jsonb_typeof(v_value)<>'array' or jsonb_array_length(v_value)>10 then raise exception 'invalid_input'; end if;
   for v_t in select value from jsonb_array_elements(v_value) loop
    if jsonb_typeof(v_t) is distinct from 'object' or (v_t-array['label','href'])<>'{}'::jsonb or jsonb_typeof(v_t->'label') is distinct from 'string'
     or length(btrim(v_t->>'label')) not between 1 and 80 or jsonb_typeof(v_t->'href') is distinct from 'string'
     or not public.valid_content_href(v_t->>'href') then raise exception 'invalid_input'; end if;
   end loop;
  end if;
  update public.app_settings set value=v_value,version=version+1,updated_by=v_actor,updated_at=clock_timestamp() where key=p_key;
 end if;
 insert into public.audit_logs(user_id,entity_type,action,new_data) values(v_actor,
  case p_kind when 'page' then 'content_page' when 'section' then 'homepage_section' else 'app_setting' end,
  'saved',jsonb_build_object('key',p_key,'version',v_version+1));
 return v_version+1;
end;
$$;

create function public.read_public_site_content(p_locale text,p_page_key text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_locale is null or p_locale not in ('ru','kk','en') or p_page_key is null or length(p_page_key)>80 then raise exception 'invalid_input'; end if;
 return jsonb_build_object(
  'page',(select jsonb_build_object('key',p.key,'template',p.template,'updated_at',p.updated_at,'title',t.title,'summary',t.summary,'body',t.body,'cta_label',t.cta_label,'cta_href',t.cta_href,
    'locales',(select jsonb_agg(locale order by locale) from public.content_page_translations where page_key=p.key))
    from public.content_pages p join public.content_page_translations t on t.page_key=p.key and t.locale=p_locale where p.key=p_page_key and p.status='published'),
  'sections',coalesce((select jsonb_agg(jsonb_build_object('key',key,'sort_order',sort_order,'display_limit',display_limit,'title',coalesce(titles->>p_locale,'')) order by sort_order,key) from public.homepage_sections where enabled),'[]'),
  'settings',(select jsonb_object_agg(key,value) from public.app_settings));
end;
$$;
revoke all on function public.list_site_content(),public.save_site_content(text,text,integer,jsonb),public.read_public_site_content(text,text) from public,anon,authenticated,service_role;
grant execute on function public.list_site_content(),public.save_site_content(text,text,integer,jsonb) to authenticated;
grant execute on function public.read_public_site_content(text,text) to anon,authenticated;

-- A bounded set of nine fixed pages can be appended to the first sitemap part.
create function public.list_public_content_paths() returns table(page_key text,locale text,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select p.key,t.locale,p.updated_at from public.content_pages p
 join public.content_page_translations t on t.page_key=p.key
 where p.status='published' order by p.key,t.locale
$$;
revoke all on function public.list_public_content_paths() from public,anon,authenticated,service_role;
grant execute on function public.list_public_content_paths() to anon,authenticated;
commit;
