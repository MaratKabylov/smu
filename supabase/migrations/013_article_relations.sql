-- Scientific publications are distinct from editorial articles. This base
-- directory supports editorial links; coauthors/results belong to stage 4.
insert into public.permissions(code, name) values ('publications.manage', 'Управление научными публикациями')
on conflict(code) do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code in ('admin', 'super_admin', 'scientist_manager') and p.code = 'publications.manage'
on conflict do nothing;
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  scientist_id uuid not null references public.scientist_profiles(id) on delete restrict,
  title text not null check(length(btrim(title)) between 3 and 500),
  year integer not null check(year between 1800 and 2200),
  journal text not null check(length(btrim(journal)) between 2 and 240),
  doi text check(doi is null or (length(doi) <= 300 and doi ~ '^10\.\d{4,9}/\S+$')),
  url text check(url is null or (length(url) <= 1000 and url ~* '^https?://' and url !~ '[[:space:][:cntrl:]]')),
  publication_type text not null check(publication_type in ('article', 'conference', 'book', 'chapter', 'other')),
  status text not null default 'draft' check(status in ('draft', 'published', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  published_at timestamptz, deleted_at timestamptz,
  check(status <> 'published' or published_at is not null)
);
create trigger publications_updated_at before update on public.publications
for each row execute function public.set_updated_at();
alter table public.publications enable row level security;
revoke all on public.publications from public, anon, authenticated, service_role;
grant select(id, scientist_id, title, year, journal, doi, url, publication_type, status, updated_at, published_at, deleted_at)
  on public.publications to anon, authenticated;
create policy publications_read_public on public.publications for select to anon, authenticated using (
  status = 'published' and deleted_at is null and published_at <= now() and exists (
    select 1 from public.scientist_profiles s where s.id = scientist_id and s.status = 'verified' and s.deleted_at is null)
);
create policy publications_read_managers on public.publications for select to authenticated using (
  public.has_permission('admin.access') and public.has_permission('publications.manage')
);
create function public.save_publication(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_id uuid; v_old public.publications%rowtype;
  v_scientist uuid := (p_input->>'scientistId')::uuid;
begin
  if not public.has_permission('publications.manage') then raise exception 'forbidden'; end if;
  if coalesce(p_input->>'status', '') not in ('draft', 'published', 'archived')
    or coalesce(p_input->>'publicationType', '') not in ('article', 'conference', 'book', 'chapter', 'other')
    or coalesce(length(btrim(p_input->>'title')), 0) not between 3 and 500
    or coalesce(length(btrim(p_input->>'journal')), 0) not between 2 and 240
    or coalesce((p_input->>'year')::integer, 0) not between 1800 and 2200
    then raise exception 'invalid_input'; end if;
  if p_id is not null then
    select * into v_old from public.publications where id = p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    if (p_input->>'expectedUpdatedAt')::timestamptz is distinct from v_old.updated_at then raise exception 'stale_version'; end if;
  end if;
  perform 1 from public.scientist_profiles where id = v_scientist for share;
  if not exists(select 1 from public.scientist_profiles where id = v_scientist and status = 'verified' and deleted_at is null)
    then raise exception 'invalid_reference'; end if;
  if p_id is null then
    insert into public.publications(scientist_id, title, year, journal, publication_type, created_by)
    values(v_scientist, btrim(p_input->>'title'), (p_input->>'year')::integer, btrim(p_input->>'journal'), p_input->>'publicationType', v_actor)
    returning id into v_id;
  else v_id := p_id; end if;
  update public.publications set scientist_id = v_scientist, title = btrim(p_input->>'title'),
    year = (p_input->>'year')::integer, journal = btrim(p_input->>'journal'), doi = nullif(p_input->>'doi', ''),
    url = nullif(p_input->>'url', ''), publication_type = p_input->>'publicationType', status = p_input->>'status',
    published_at = case when p_input->>'status' = 'published' then coalesce(v_old.published_at, now()) else null end
    where id = v_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values(v_actor, 'publication', v_id, 'publication.save', case when p_id is null then null else to_jsonb(v_old) end,
      jsonb_build_object('title', p_input->>'title', 'scientistId', v_scientist, 'status', p_input->>'status'));
  return v_id;
end;
$$;
revoke all on function public.save_publication(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_publication(uuid, jsonb) to authenticated;

create function public.list_public_publications(p_locale text, p_id uuid default null, p_scientist uuid default null)
returns table(id uuid, scientist_id uuid, title text, year integer, journal text, doi text, url text,
  publication_type text, scientist_name text, scientist_href text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.scientist_id, p.title, p.year, p.journal, p.doi, p.url, p.publication_type,
    t.full_name, '/scientists/' || t.locale || '/' || t.slug
  from public.publications p join public.scientist_profiles s on s.id = p.scientist_id
  join public.scientist_profile_translations t on t.scientist_profile_id = s.id and t.locale = p_locale
  where p.status = 'published' and p.deleted_at is null and p.published_at <= now()
    and s.status = 'verified' and s.deleted_at is null
    and (p_id is null or p.id = p_id) and (p_scientist is null or p.scientist_id = p_scientist)
  order by p.year desc, p.title, p.id limit 100
$$;
revoke all on function public.list_public_publications(text, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_public_publications(text, uuid, uuid) to anon, authenticated;

-- Separate FK-backed links, never identifiers embedded in rich text.
create table public.article_scientists (
  article_id uuid not null references public.articles(id) on delete cascade,
  scientist_id uuid not null references public.scientist_profiles(id) on delete restrict,
  relation_type text not null check(relation_type in ('author', 'subject', 'expert', 'mentioned', 'reviewer')),
  sort_order integer not null check(sort_order >= 0), primary key(article_id, scientist_id)
);
create table public.article_projects (
  article_id uuid not null references public.articles(id) on delete cascade,
  project_id uuid not null references public.science_works(id) on delete restrict,
  relation_type text not null check(relation_type in ('author', 'subject', 'expert', 'mentioned', 'reviewer')),
  sort_order integer not null check(sort_order >= 0), primary key(article_id, project_id)
);
create table public.article_research (
  article_id uuid not null references public.articles(id) on delete cascade,
  research_id uuid not null references public.science_works(id) on delete restrict,
  relation_type text not null check(relation_type in ('author', 'subject', 'expert', 'mentioned', 'reviewer')),
  sort_order integer not null check(sort_order >= 0), primary key(article_id, research_id)
);
create table public.article_events (
  article_id uuid not null references public.articles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  relation_type text not null check(relation_type in ('author', 'subject', 'expert', 'mentioned', 'reviewer')),
  sort_order integer not null check(sort_order >= 0), primary key(article_id, event_id)
);
create table public.article_publications (
  article_id uuid not null references public.articles(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete restrict,
  relation_type text not null check(relation_type in ('author', 'subject', 'expert', 'mentioned', 'reviewer')),
  sort_order integer not null check(sort_order >= 0), primary key(article_id, publication_id)
);
create index article_scientists_reverse_idx on public.article_scientists(scientist_id);
create index article_projects_reverse_idx on public.article_projects(project_id);
create index article_research_reverse_idx on public.article_research(research_id);
create index article_events_reverse_idx on public.article_events(event_id);
create index article_publications_reverse_idx on public.article_publications(publication_id);

-- These private views have no client grants. Public RPCs below always apply
-- public visibility, including when the request carries a manager's session.
create view public.smu_article_links as
select article_id, 'scientist'::text kind, scientist_id entity_id, relation_type, sort_order from public.article_scientists
union all select article_id, 'project', project_id, relation_type, sort_order from public.article_projects
union all select article_id, 'research', research_id, relation_type, sort_order from public.article_research
union all select article_id, 'event', event_id, relation_type, sort_order from public.article_events
union all select article_id, 'publication', publication_id, relation_type, sort_order from public.article_publications;
create view public.smu_public_relation_targets as
select 'scientist'::text kind, s.id entity_id, t.locale, t.full_name title, '/scientists/' || t.locale || '/' || t.slug href
from public.scientist_profiles s join public.scientist_profile_translations t on t.scientist_profile_id = s.id
where s.status = 'verified' and s.deleted_at is null
union all
select w.kind::text, w.id, t.locale, t.title,
  case when w.kind = 'project' then '/projects/' else '/research/' end || t.locale || '/' || t.slug
from public.science_works w join public.science_work_translations t on t.work_id = w.id
where w.status = 'published' and w.deleted_at is null and w.published_at <= now()
union all
select 'event', e.id, t.locale, t.title, '/events/' || t.locale || '/' || t.slug
from public.events e join public.event_translations t on t.event_id = e.id
where e.status in ('published', 'cancelled') and e.deleted_at is null and e.published_at <= now()
union all
select 'publication', p.id, l.locale, p.title, '/publications/' || l.locale || '/' || p.id
from public.publications p cross join (values ('ru'), ('kk')) l(locale)
join public.scientist_profiles s on s.id = p.scientist_id
where p.status = 'published' and p.deleted_at is null and p.published_at <= now() and s.status = 'verified' and s.deleted_at is null;
revoke all on public.smu_article_links, public.smu_public_relation_targets from public, anon, authenticated, service_role;

do $$ declare v_table text; begin
  foreach v_table in array array['article_scientists', 'article_projects', 'article_research', 'article_events', 'article_publications'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', v_table);
    execute format('grant select on public.%I to authenticated', v_table);
    execute format('create policy editorial_links_read on public.%I for select to authenticated using (
      public.has_permission(''admin.access'') and exists(select 1 from public.articles a where a.id = article_id and a.deleted_at is null and (
        public.has_permission(''articles.edit_any'') or public.has_permission(''articles.publish'')
        or (a.author_id = auth.uid() and public.has_permission(''articles.edit_own''))
        or (a.scientific_reviewer_id = auth.uid() and public.has_permission(''articles.review'')))))', v_table);
  end loop;
end $$;

create function public.search_article_relation_targets(p_kind text, p_query text default '', p_ids uuid[] default null)
returns table(kind text, entity_id uuid, title_ru text, title_kk text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_smu_session();
  if not (public.has_permission('articles.create') or public.has_permission('articles.edit_own') or public.has_permission('articles.edit_any')
    or public.has_permission('articles.review') or public.has_permission('articles.publish') or public.has_permission('publications.manage'))
    then raise exception 'forbidden'; end if;
  if p_kind not in ('scientist', 'project', 'research', 'event', 'publication') or p_kind is null
    or length(coalesce(p_query, '')) > 120 or coalesce(cardinality(p_ids), 0) > 50 then raise exception 'invalid_input'; end if;
  return query select ru.kind, ru.entity_id, ru.title, kk.title
    from public.smu_public_relation_targets ru join public.smu_public_relation_targets kk
      on kk.kind = ru.kind and kk.entity_id = ru.entity_id and kk.locale = 'kk'
    where ru.kind = p_kind and ru.locale = 'ru'
      and (p_ids is null or ru.entity_id = any(p_ids))
      and (ru.title ilike '%' || coalesce(p_query, '') || '%' or kk.title ilike '%' || coalesce(p_query, '') || '%')
    order by ru.title, ru.entity_id limit 50;
end;
$$;
create function public.public_article_relations(p_article uuid, p_locale text)
returns table(kind text, entity_id uuid, title text, href text, relation_type text)
language sql stable security definer set search_path = '' as $$
  select t.kind, t.entity_id, t.title, t.href, l.relation_type
  from public.smu_article_links l join public.smu_public_relation_targets t
    on t.kind = l.kind and t.entity_id = l.entity_id and t.locale = p_locale
  join public.articles a on a.id = l.article_id
  where a.id = p_article and a.status = 'published' and a.deleted_at is null and a.published_at <= now()
  order by l.sort_order
$$;
create function public.public_related_articles(p_kind text, p_entity uuid, p_locale text)
returns table(id uuid, title text, href text, excerpt text, relation_type text)
language sql stable security definer set search_path = '' as $$
  select a.id, tr.title, '/journal/' || tr.locale || '/' || tr.slug, tr.excerpt, l.relation_type
  from public.smu_article_links l join public.articles a on a.id = l.article_id
  join public.article_translations tr on tr.article_id = a.id and tr.locale = p_locale
  where l.kind = p_kind and l.entity_id = p_entity and a.status = 'published' and a.deleted_at is null and a.published_at <= now()
    and exists(select 1 from public.smu_public_relation_targets t where t.kind = p_kind and t.entity_id = p_entity and t.locale = p_locale)
  order by a.published_at desc, a.id limit 60
$$;
revoke all on function public.search_article_relation_targets(text, text, uuid[]),
  public.public_article_relations(uuid, text), public.public_related_articles(text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.search_article_relation_targets(text, text, uuid[]) to authenticated;
grant execute on function public.public_article_relations(uuid, text), public.public_related_articles(text, uuid, text) to anon, authenticated;

-- Keep the established content mutation internal; the public entry point adds
-- links under the same article lock, transaction, version and audit.
alter function public.save_article(uuid, jsonb) rename to save_article_content;
revoke all on function public.save_article_content(uuid, jsonb) from public, anon, authenticated, service_role;
create function public.save_article(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_links jsonb; v_old_links jsonb; v_link jsonb; v_kind text; v_table text; v_column text; v_target uuid;
begin
  v_id := public.save_article_content(p_id, p_input);
  v_links := coalesce(p_input->'relations', (select jsonb_agg(jsonb_build_object('kind', kind, 'entityId', entity_id, 'relationType', relation_type)
    order by sort_order) from public.smu_article_links where article_id = v_id), '[]'::jsonb);
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'entityId', entity_id, 'relationType', relation_type) order by sort_order), '[]'::jsonb)
    into v_old_links from public.smu_article_links where article_id = v_id;
  if jsonb_typeof(v_links) is distinct from 'array' or jsonb_array_length(v_links) > 50 then raise exception 'invalid_input'; end if;
  if (select count(*) <> count(distinct (value->>'kind', value->>'entityId')) from jsonb_array_elements(v_links))
    then raise exception 'invalid_input'; end if;
  -- Lock targets in a stable order so depublication cannot race validation.
  for v_link in select value from jsonb_array_elements(v_links) order by value->>'kind', value->>'entityId' loop
    v_kind := v_link->>'kind';
    if jsonb_typeof(v_link) is distinct from 'object' or coalesce(v_kind, '') not in ('scientist', 'project', 'research', 'event', 'publication')
      or coalesce(v_link->>'relationType', '') not in ('author', 'subject', 'expert', 'mentioned', 'reviewer')
      or coalesce(v_link->>'entityId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then raise exception 'invalid_input'; end if;
    v_target := (v_link->>'entityId')::uuid;
    v_table := case v_kind when 'scientist' then 'scientist_profiles' when 'project' then 'science_works'
      when 'research' then 'science_works' when 'event' then 'events' else 'publications' end;
    execute format('select 1 from public.%I where id = $1 for share', v_table) using v_target;
    if v_kind = 'publication' then
      perform 1 from public.scientist_profiles s join public.publications p on p.scientist_id = s.id where p.id = v_target for share of s;
    end if;
    if (select count(*) from public.smu_public_relation_targets where kind = v_kind and entity_id = v_target) <> 2
      then raise exception 'invalid_reference'; end if;
  end loop;
  foreach v_kind in array array['scientist', 'project', 'research', 'event', 'publication'] loop
    v_table := case v_kind when 'scientist' then 'article_scientists' when 'project' then 'article_projects'
      when 'research' then 'article_research' when 'event' then 'article_events' else 'article_publications' end;
    v_column := case v_kind when 'scientist' then 'scientist_id' when 'project' then 'project_id'
      when 'research' then 'research_id' when 'event' then 'event_id' else 'publication_id' end;
    execute format('delete from public.%I where article_id = $1', v_table) using v_id;
    execute format('insert into public.%I(article_id, %I, relation_type, sort_order)
      select $1, (value->>''entityId'')::uuid, value->>''relationType'', position - 1
      from jsonb_array_elements($2) with ordinality as links(value, position) where value->>''kind'' = $3', v_table, v_column)
      using v_id, v_links, v_kind;
  end loop;
  if v_old_links is distinct from v_links then
    insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
      values(auth.uid(), 'article', v_id, 'article.relations.save', jsonb_build_object('relations', v_old_links), jsonb_build_object('relations', v_links));
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_article(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_article(uuid, jsonb) to authenticated;

-- Old snapshots accurately represent a time before editorial links existed.
update public.article_revisions set snapshot = snapshot || jsonb_build_object('relations', '[]'::jsonb);

create or replace function public.capture_article_revision(p_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session(); v_article public.articles%rowtype;
  v_snapshot jsonb; v_translations jsonb; v_id uuid;
begin
  select * into v_article from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if (select count(*) from public.article_translations where article_id = p_id) <> 2
    then raise exception 'invalid_input'; end if;
  select jsonb_object_agg(locale, jsonb_build_object(
    'title', title, 'slug', slug, 'excerpt', excerpt, 'body', body,
    'contentJson', content_json, 'seoTitle', seo_title, 'seoDescription', seo_description
  )) into v_translations from public.article_translations where article_id = p_id;
  v_snapshot := jsonb_build_object(
    'contentType', v_article.content_type, 'categoryId', v_article.category_id,
    'relations', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'entityId', entity_id, 'relationType', relation_type) order by sort_order) from public.smu_article_links where article_id = p_id), '[]'::jsonb),
    'coverMediaId', v_article.cover_media_id,
    'categoryIds', coalesce((select jsonb_agg(category_id order by sort_order) from public.article_category_links where article_id = p_id), '[]'::jsonb),
    'authors', coalesce((select jsonb_agg(jsonb_build_object('authorId', author_id, 'role', role) order by sort_order) from public.article_authors where article_id = p_id), '[]'::jsonb),
    'tagIds', coalesce((select jsonb_agg(tag_id order by tag_id) from public.article_tag_links where article_id = p_id), '[]'::jsonb)
  ) || v_translations;
  insert into public.article_revisions(article_id, revision_number, content_version, reason, title_ru, title_kk, snapshot, created_by)
    select p_id, coalesce(max(revision_number), 0) + 1, v_article.content_version, p_reason,
      v_snapshot->'ru'->>'title', v_snapshot->'kk'->>'title', v_snapshot, v_actor
    from public.article_revisions where article_id = p_id returning id into v_id;
  -- Keep historical images referenced for the media library's deletion guard.
  insert into public.media_usages(media_asset_id, entity_type, entity_id, field_name)
    select v_article.cover_media_id, 'article_revision', v_id, 'cover' where v_article.cover_media_id is not null;
  insert into public.media_usages(media_asset_id, entity_type, entity_id, field_name)
    select distinct (image.value->'attrs'->>'mediaId')::uuid, 'article_revision', v_id, 'content_' || t.locale
    from public.article_translations t
    cross join lateral jsonb_path_query(t.content_json, '$.** ? (@.type == "image")') image(value)
    where t.article_id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, new_data)
    values (v_actor, 'article', p_id, 'article.revision.create', jsonb_build_object(
      'revisionId', v_id, 'reason', p_reason, 'contentVersion', v_article.content_version));
  return v_id;
end;
$$;

revoke all on function public.capture_article_revision(uuid, text) from public, anon, authenticated, service_role;
