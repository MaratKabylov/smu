-- Opportunities use session-bound editorial RPCs. Public projections never
-- widen with the caller's administrative permissions.
begin;
insert into public.permissions(code,name) values ('opportunities.manage','Управление возможностями') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('admin','super_admin','content_manager') and p.code='opportunities.manage' on conflict do nothing;

create table public.opportunities (
 id uuid primary key default gen_random_uuid(),
 type text not null check(type in ('grant','conference','internship','competition','open_call','scholarship','other')),
 country text not null default '' check(country='' or country ~ '^[A-Z]{2}$'),
 deadline timestamptz,
 source_url text not null check(length(source_url) between 10 and 2000 and source_url ~ '^https?://[^[:space:]/?#@\\]+([/?#][^[:space:]\\]*)?$'),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 published_at timestamptz,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index opportunities_public_idx on public.opportunities(status,deadline,id) where deleted_at is null;
create table public.opportunity_translations (
 opportunity_id uuid not null references public.opportunities(id) on delete restrict,
 locale text not null check(locale in ('ru','kk','en')),
 slug text not null check(length(slug) between 2 and 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text not null check(length(title) between 3 and 240),
 summary text not null check(length(summary) between 20 and 800),
 description text not null check(length(description) between 40 and 30000),
 organization text not null check(length(organization) between 2 and 240),
 funding text not null default '' check(length(funding)<=1000),
 search_document tsvector generated always as (public.search_vector(locale,title,summary || ' ' || description || ' ' || organization || ' ' || funding)) stored,
 primary key(opportunity_id,locale), unique(locale,slug)
);
create index opportunity_translations_search_idx on public.opportunity_translations using gin(search_document);
-- Permanent reservations survive edits and removal of optional translations.
create table public.opportunity_slugs (
 locale text not null,
 slug text not null,
 opportunity_id uuid not null references public.opportunities(id) on delete restrict,
 primary key(locale,slug)
);
alter table public.opportunities enable row level security;
alter table public.opportunity_translations enable row level security;
alter table public.opportunity_slugs enable row level security;
revoke all on public.opportunities,public.opportunity_translations,public.opportunity_slugs from public,anon,authenticated,service_role;

create function public.save_opportunity(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_smu_session(); v_id uuid; v_old public.opportunities%rowtype;
 v_t jsonb; v_locale text; v_slug text; v_deadline timestamptz; v_count integer;
begin
 if not public.has_permission('opportunities.manage') then raise exception 'forbidden'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object'
  or coalesce(p_input->>'type','') not in ('grant','conference','internship','competition','open_call','scholarship','other')
  or coalesce(p_input->>'country','!') !~ '^([A-Z]{2})?$'
  or jsonb_typeof(p_input->'sourceUrl') is distinct from 'string'
  or length(p_input->>'sourceUrl') not between 10 and 2000
  or (p_input->>'sourceUrl') !~ '^https?://[^[:space:]/?#@\\]+([/?#][^[:space:]\\]*)?$'
  or jsonb_typeof(p_input->'translations') is distinct from 'array' then raise exception 'invalid_input'; end if;
 if p_input->>'deadline' is not null then
  if jsonb_typeof(p_input->'deadline')<>'string' or (p_input->>'deadline') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'invalid_input'; end if;
  begin v_deadline:=(p_input->>'deadline')::timestamptz;
  exception when others then raise exception 'invalid_input'; end;
 end if;
 v_count:=jsonb_array_length(p_input->'translations');
 if v_count not between 2 and 3 or
  (select count(distinct t->>'locale') from jsonb_array_elements(p_input->'translations') t)<>v_count
  or not exists(select 1 from jsonb_array_elements(p_input->'translations') t where t->>'locale'='ru')
  or not exists(select 1 from jsonb_array_elements(p_input->'translations') t where t->>'locale'='kk') then raise exception 'invalid_input'; end if;
 if p_input->>'id' is null then
  if p_input->>'version' is not null then raise exception 'invalid_input'; end if;
  insert into public.opportunities(type,country,deadline,source_url) values(p_input->>'type',p_input->>'country',v_deadline,p_input->>'sourceUrl') returning id into v_id;
 else
  v_id:=(p_input->>'id')::uuid;
  select * into v_old from public.opportunities where id=v_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_input->>'version' is null or v_old.version is distinct from (p_input->>'version')::integer then raise exception 'stale_version'; end if;
  update public.opportunities set type=p_input->>'type',country=p_input->>'country',deadline=v_deadline,source_url=p_input->>'sourceUrl',status='draft',version=version+1,updated_at=now() where id=v_id;
 end if;
 for v_t in select value from jsonb_array_elements(p_input->'translations') order by value->>'locale' loop
  v_locale:=v_t->>'locale'; v_slug:=v_t->>'slug';
  if jsonb_typeof(v_t)<>'object' or coalesce(v_locale,'') not in ('ru','kk','en')
   or jsonb_typeof(v_t->'slug') is distinct from 'string' or length(v_slug) not between 2 and 160 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'invalid_input'; end if;
  if exists(select 1 from jsonb_each(v_t) e where e.key in ('title','summary','description','organization','funding') and jsonb_typeof(e.value)<>'string')
   or length(btrim(coalesce(v_t->>'title',''))) not between 3 and 240
   or length(btrim(coalesce(v_t->>'summary',''))) not between 20 and 800
   or length(btrim(coalesce(v_t->>'description',''))) not between 40 and 30000
   or length(btrim(coalesce(v_t->>'organization',''))) not between 2 and 240
   or length(coalesce(v_t->>'funding',''))>1000 then raise exception 'invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('opportunity_slug:' || v_locale,0));
  insert into public.opportunity_slugs(locale,slug,opportunity_id) values(v_locale,v_slug,v_id) on conflict do nothing;
  if not exists(select 1 from public.opportunity_slugs where locale=v_locale and slug=v_slug and opportunity_id=v_id) then raise exception 'slug_reserved'; end if;
  insert into public.opportunity_translations(opportunity_id,locale,slug,title,summary,description,organization,funding)
   values(v_id,v_locale,v_slug,btrim(v_t->>'title'),btrim(v_t->>'summary'),btrim(v_t->>'description'),btrim(v_t->>'organization'),btrim(coalesce(v_t->>'funding','')))
   on conflict(opportunity_id,locale) do update set slug=excluded.slug,title=excluded.title,summary=excluded.summary,description=excluded.description,organization=excluded.organization,funding=excluded.funding;
 end loop;
 delete from public.opportunity_translations where opportunity_id=v_id and locale not in (select t->>'locale' from jsonb_array_elements(p_input->'translations') t);
 insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data) values(v_actor,'opportunity',v_id,'opportunity.save',jsonb_build_object('version',coalesce(v_old.version,0)+1,'status','draft'));
 return v_id;
end $$;

create function public.change_opportunity_status(p_id uuid,p_version integer,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_smu_session(); v_old public.opportunities%rowtype;
begin
 if not public.has_permission('opportunities.manage') then raise exception 'forbidden'; end if;
 if p_status is null or p_status not in ('draft','published','archived') or p_version is null then raise exception 'invalid_input'; end if;
 select * into v_old from public.opportunities where id=p_id and deleted_at is null for update;
 if not found then raise exception 'not_found'; end if;
 if v_old.version<>p_version then raise exception 'stale_version'; end if;
 if v_old.status=p_status then return; end if;
 if v_old.status='archived' and p_status<>'draft' then raise exception 'invalid_transition'; end if;
 if p_status='published' and (select count(*) from public.opportunity_translations where opportunity_id=p_id and locale in ('ru','kk'))<>2 then raise exception 'invalid_input'; end if;
 update public.opportunities set status=p_status,version=version+1,updated_at=now(),published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end where id=p_id;
 insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data) values(v_actor,'opportunity',p_id,'opportunity.status',jsonb_build_object('status',v_old.status),jsonb_build_object('status',p_status,'version',p_version+1));
end $$;

create function public.list_opportunities(p_locale text default 'ru',p_page integer default 1,p_id uuid default null,
 p_slug text default null,p_manage boolean default false,p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if p_manage then
  perform public.require_smu_session();
  if not public.has_permission('opportunities.manage') then raise exception 'forbidden'; end if;
 end if;
 if p_locale is null or p_locale not in ('ru','kk','en') or p_manage is null
  or p_page is null or p_page not between 1 and 1000000 or p_filters is null or jsonb_typeof(p_filters)<>'object'
  or length(coalesce(p_filters->>'q',''))>120
  or coalesce(p_filters->>'type','all') not in ('all','grant','conference','internship','competition','open_call','scholarship','other')
  or coalesce(p_filters->>'availability','all') not in ('all','open','closed')
  or coalesce(p_filters->>'status','all') not in ('all','draft','published','archived')
  or coalesce(p_filters->>'country','') !~ '^([A-Z]{2})?$'
  or (p_slug is not null and (length(p_slug) not between 2 and 160 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$')) then raise exception 'invalid_input'; end if;
 with matched as (
  select o.* from public.opportunities o where o.deleted_at is null
   and (p_manage or (o.status='published' and o.published_at<=now()))
   and (p_id is null or o.id=p_id)
   and (p_slug is null or exists(select 1 from public.opportunity_slugs s where s.opportunity_id=o.id and s.locale=p_locale and s.slug=p_slug))
   and (p_manage or exists(select 1 from public.opportunity_translations t where t.opportunity_id=o.id and t.locale=p_locale))
   and (coalesce(p_filters->>'status','all')='all' or o.status=p_filters->>'status')
   and (coalesce(p_filters->>'type','all')='all' or o.type=p_filters->>'type')
   and (coalesce(p_filters->>'country','')='' or o.country=p_filters->>'country')
   and (coalesce(p_filters->>'availability','all')='all'
    or (p_filters->>'availability'='open' and (o.deadline is null or o.deadline>now()))
    or (p_filters->>'availability'='closed' and o.deadline<=now()))
   and (coalesce(p_filters->>'q','')='' or exists(select 1 from public.opportunity_translations t where t.opportunity_id=o.id
    and (p_manage or t.locale=p_locale) and t.search_document @@ websearch_to_tsquery(case t.locale when 'ru' then 'pg_catalog.russian'::regconfig when 'en' then 'pg_catalog.english'::regconfig else 'pg_catalog.simple'::regconfig end,p_filters->>'q')))
 ), page as (
  select * from matched order by case when p_manage then updated_at end desc,
   case when deadline>now() then 0 when deadline is null then 1 else 2 end,deadline asc nulls last,id
   limit 12 offset (p_page::bigint-1)*12
 ) select jsonb_build_object('total',(select count(*) from matched),'page',p_page,'pageSize',12,'items',coalesce((select jsonb_agg(
  jsonb_build_object('id',o.id,'type',o.type,'country',o.country,'deadline',o.deadline,'sourceUrl',o.source_url,'status',o.status,'publishedAt',o.published_at,
   'translations',(select jsonb_agg(jsonb_build_object('locale',t.locale,'slug',t.slug,'title',t.title,'summary',t.summary,
    'organization',t.organization,'funding',t.funding,'description',case when p_id is not null or p_slug is not null then t.description else '' end) order by t.locale)
    from public.opportunity_translations t where t.opportunity_id=o.id)) || case when p_manage then jsonb_build_object('version',o.version) else '{}'::jsonb end
 ) from page o),'[]'::jsonb)) into v_result;
 return v_result;
end $$;

revoke all on function public.save_opportunity(jsonb),public.change_opportunity_status(uuid,integer,text),public.list_opportunities(text,integer,uuid,text,boolean,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_opportunity(jsonb),public.change_opportunity_status(uuid,integer,text) to authenticated;
grant execute on function public.list_opportunities(text,integer,uuid,text,boolean,jsonb) to anon,authenticated;

-- Append to the current projection, preserving all earlier privacy fixes.
do $$ declare v_definition text; begin
 select pg_get_viewdef('public.search_entries'::regclass,true) into v_definition;
 execute 'create or replace view public.search_entries as ' || rtrim(v_definition,E'; \n\r') || $view$
 union all select o.id,'opportunities',t.locale,t.title,t.summary,
 '/' || t.locale || '/opportunities/' || t.slug,'/admin/opportunities/' || o.id,
 o.status='published' and o.published_at<=now(),public.has_permission('opportunities.manage'),
 o.published_at,o.updated_at,t.search_document,
 jsonb_build_object('type',o.type,'country',o.country,'availability',case when o.deadline is null or o.deadline>now() then 'open' else 'closed' end)
 from public.opportunities o join public.opportunity_translations t on t.opportunity_id=o.id where o.deleted_at is null
 $view$;
end $$;
revoke all on public.search_entries from public,anon,authenticated,service_role;
create or replace function public.search_public(p_locale text, p_query text default '', p_section text default '',
  p_filters jsonb default '{}', p_page integer default 1, p_page_size integer default 12)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_query tsquery; v_simple tsquery; v_result jsonb;
begin
  if p_locale is null or p_locale not in ('ru', 'kk', 'en') or p_query is null or length(p_query) > 120
    or p_page is null or p_page not between 1 and 1000000 or p_page_size is null or p_page_size not between 1 and 60
    or p_section is null or p_section not in ('', 'journal', 'scientists', 'research', 'projects', 'publications', 'mentorship', 'research-program', 'events', 'organizations', 'opportunities')
    or p_filters is null or jsonb_typeof(p_filters) <> 'object' then raise exception 'invalid_input'; end if;
  v_query := websearch_to_tsquery(case p_locale when 'ru' then 'pg_catalog.russian'::regconfig
    when 'en' then 'pg_catalog.english'::regconfig else 'pg_catalog.simple'::regconfig end, btrim(p_query));
  v_simple := websearch_to_tsquery('pg_catalog.simple'::regconfig, btrim(p_query));
  with matched as (
    select e.*, case when btrim(p_query) = '' then 0 else ts_rank(e.search_document,
      case when e.section = 'publications' then v_simple else v_query end) end rank
    from public.search_entries e
    where e.is_public and e.locale = p_locale and (p_section = '' or e.section = p_section)
      and (btrim(p_query) = '' or e.search_document @@ case when e.section = 'publications' then v_simple else v_query end)
      and not exists(select 1 from jsonb_each_text(p_filters) f where f.key <> 'period' and f.value not in ('', 'all') and (
        (f.key = 'field' and not exists(
          with recursive field_tree as (
            select id, slug from public.scientific_fields where slug = f.value and is_active
            union all
            select child.id, child.slug from public.scientific_fields child join field_tree parent on child.parent_id = parent.id
              where child.is_active
          ) select 1 from field_tree where coalesce(e.attributes -> 'field' @> to_jsonb(field_tree.slug), false)
        ))
        or (f.key <> 'field' and not coalesce(e.attributes -> f.key @> to_jsonb(f.value), false))
      ))
      and (coalesce(p_filters ->> 'period', 'all') = 'all'
        or (p_filters ->> 'period' = 'upcoming' and (e.attributes ->> 'ends_at')::timestamptz > now())
        or (p_filters ->> 'period' = 'past' and (e.attributes ->> 'ends_at')::timestamptz <= now()))
  ), page as (
    select * from matched order by rank desc,
      case when p_section = 'events' and coalesce(p_filters ->> 'period', '') <> 'past' then sort_at end asc nulls last,
      sort_at desc nulls last, section, id
    limit p_page_size offset (p_page::bigint - 1) * p_page_size
  ) select jsonb_build_object('total', (select count(*) from matched), 'page', p_page, 'pageSize', p_page_size,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'section', section, 'locale', locale,
      'title', title, 'summary', summary, 'href', href)) from page), '[]'::jsonb)) into v_result;
  return v_result;
end $$;

create or replace function public.seo_public_page(p_page integer default 1, p_page_size integer default 1000,
  p_section text default '', p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_page is null or p_page not between 1 and 1000000 or p_page_size is null or p_page_size not between 1 and 1000
    or p_section is null or p_section not in ('', 'journal', 'scientists', 'research', 'projects', 'publications', 'mentorship', 'research-program', 'events', 'opportunities')
    then raise exception 'invalid_input'; end if;
  with visible as (
    select e.id, e.section, max(e.updated_at) updated_at,
      jsonb_agg(jsonb_build_object('locale', e.locale, 'href', e.href) order by e.locale) translations
    from public.search_entries e
    where e.is_public and e.section in ('journal', 'scientists', 'research', 'projects', 'publications', 'mentorship', 'research-program', 'events', 'opportunities')
      and (p_section = '' or e.section = p_section) and (p_id is null or e.id = p_id)
    group by e.section, e.id
  ), page as (
    select * from visible order by section, id
    limit p_page_size offset (p_page::bigint - 1) * p_page_size
  ) select jsonb_build_object('total', (select count(*) from visible),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'section', section,
      'updatedAt', updated_at, 'translations', translations) order by section, id) from page), '[]'::jsonb)) into v_result;
  return v_result;
end $$;


commit;
