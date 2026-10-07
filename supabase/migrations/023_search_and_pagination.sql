-- Weighted, locale-aware FTS. Kazakh uses PostgreSQL's simple tokenizer.
create function public.search_vector(p_locale text, p_title text, p_body text)
returns tsvector language sql immutable parallel safe set search_path = '' as $$
  select setweight(to_tsvector(case p_locale when 'ru' then 'pg_catalog.russian'::regconfig
    when 'en' then 'pg_catalog.english'::regconfig else 'pg_catalog.simple'::regconfig end, coalesce(p_title, '')), 'A')
    || setweight(to_tsvector(case p_locale when 'ru' then 'pg_catalog.russian'::regconfig
    when 'en' then 'pg_catalog.english'::regconfig else 'pg_catalog.simple'::regconfig end, coalesce(p_body, '')), 'B')
$$;

alter table public.article_translations add column search_document tsvector generated always as
  (public.search_vector(locale, title, coalesce(excerpt, '') || ' ' || body)) stored;
alter table public.scientist_profile_translations add column search_document tsvector generated always as
  (public.search_vector(locale, full_name, position || ' ' || coalesce(academic_degree, '') || ' ' || short_bio || ' ' || biography)) stored;
alter table public.science_work_translations add column search_document tsvector generated always as
  (public.search_vector(locale, title, summary || ' ' || description || ' ' || results)) stored;
alter table public.mentorship_offer_translations add column search_document tsvector generated always as
  (public.search_vector(locale, title, summary || ' ' || description)) stored;
alter table public.research_program_translations add column search_document tsvector generated always as
  (public.search_vector(locale, title, summary || ' ' || description || ' ' || curriculum || ' ' || eligibility || ' ' || outcomes)) stored;
alter table public.event_translations add column search_document tsvector generated always as
  (public.search_vector(locale, title, summary || ' ' || description || ' ' || organizer || ' ' || location)) stored;
alter table public.scientific_organization_translations add column search_document tsvector generated always as
  (public.search_vector(locale, name, coalesce(city, ''))) stored;
alter table public.publications add column search_document tsvector generated always as
  (public.search_vector('simple', title, journal || ' ' || coalesce(doi, ''))) stored;
alter table public.profiles add column search_document tsvector generated always as
  (public.search_vector('simple', display_name, '')) stored;
alter table public.media_assets add column search_document tsvector generated always as
  (public.search_vector('simple', file_name, coalesce(alt_ru, '') || ' ' || coalesce(alt_kk, ''))) stored;
alter table public.mentorship_applications add column search_document tsvector generated always as
  (public.search_vector('simple', full_name, email || ' ' || translate(email, '@.', '  ') || ' ' || motivation)) stored;
alter table public.research_program_applications add column search_document tsvector generated always as
  (public.search_vector('simple', full_name, email || ' ' || translate(email, '@.', '  ') || ' ' || motivation)) stored;

create index article_translations_search_idx on public.article_translations using gin(search_document);
create index scientist_translations_search_idx on public.scientist_profile_translations using gin(search_document);
create index work_translations_search_idx on public.science_work_translations using gin(search_document);
create index mentorship_translations_search_idx on public.mentorship_offer_translations using gin(search_document);
create index program_translations_search_idx on public.research_program_translations using gin(search_document);
create index event_translations_search_idx on public.event_translations using gin(search_document);
create index organization_translations_search_idx on public.scientific_organization_translations using gin(search_document);
create index publications_search_idx on public.publications using gin(search_document);
create index profiles_search_idx on public.profiles using gin(search_document);
create index media_search_idx on public.media_assets using gin(search_document);
create index mentorship_applications_search_idx on public.mentorship_applications using gin(search_document);
create index program_applications_search_idx on public.research_program_applications using gin(search_document);

-- Internal projection: NEVER grant access to this view. Both RPCs enforce
-- visibility before counting, ranking or pagination, even for manager sessions.
create view public.search_entries as
select a.id, 'journal'::text section, t.locale, t.title, coalesce(t.excerpt, '') summary,
  '/' || t.locale || '/journal/' || t.slug href, '/admin/content/articles/' || a.id admin_href,
  a.status = 'published' and a.published_at <= now() is_public,
  (public.has_permission('articles.edit_any') or public.has_permission('articles.publish')
    or (a.author_id = auth.uid() and public.has_permission('articles.edit_own'))
    or (a.scientific_reviewer_id = auth.uid() and public.has_permission('articles.review'))) admin_allowed,
  a.published_at sort_at, a.updated_at, t.search_document,
  jsonb_build_object('category', coalesce((select jsonb_agg(c.slug) from public.article_category_links l
    join public.article_categories c on c.id = l.category_id where l.article_id = a.id), '[]'::jsonb),
    'tag', coalesce((select jsonb_agg(g.slug) from public.article_tag_links l
    join public.article_tags g on g.id = l.tag_id where l.article_id = a.id), '[]'::jsonb)) attributes
from public.articles a join public.article_translations t on t.article_id = a.id where a.deleted_at is null
union all
select s.id, 'scientists', t.locale, t.full_name, t.short_bio,
  '/' || t.locale || '/scientists/' || t.slug, '/admin/science/scientists/' || s.id,
  s.status = 'verified', public.has_permission('scientists.edit') or public.has_permission('scientists.verify'),
  s.verified_at, s.updated_at, t.search_document,
  jsonb_build_object('organization', o.slug, 'field', coalesce((select jsonb_agg(f.slug)
    from public.scientist_field_links l join public.scientific_fields f on f.id = l.scientific_field_id
    where l.scientist_profile_id = s.id), '[]'::jsonb))
from public.scientist_profiles s join public.scientist_profile_translations t on t.scientist_profile_id = s.id
left join public.scientific_organizations o on o.id = s.organization_id where s.deleted_at is null
union all
select w.id, case w.kind when 'project' then 'projects' else 'research' end, t.locale, t.title, t.summary,
  '/' || t.locale || '/' || case w.kind when 'project' then 'projects' else 'research' end || '/' || t.slug,
  '/admin/science/' || case w.kind when 'project' then 'projects' else 'research' end || '/' || w.id,
  w.status = 'published' and w.published_at <= now(),
  public.has_permission(case w.kind when 'project' then 'projects.manage' else 'research.manage' end),
  w.updated_at, w.updated_at, t.search_document,
  jsonb_build_object('organization', o.slug, 'field', f.slug, 'stage', w.stage)
from public.science_works w join public.science_work_translations t on t.work_id = w.id
join public.scientific_fields f on f.id = w.field_id
left join public.scientific_organizations o on o.id = w.organization_id where w.deleted_at is null
union all
select m.id, 'mentorship', t.locale, t.title, t.summary,
  '/' || t.locale || '/mentorship/' || t.slug, '/admin/programs/mentorship/' || m.id,
  m.status = 'published' and s.status = 'verified' and s.deleted_at is null and f.is_active
    and exists(select 1 from public.scientist_profile_translations st where st.scientist_profile_id = s.id and st.locale = t.locale),
  public.has_permission('mentorship.manage'), m.updated_at, m.updated_at, t.search_document,
  jsonb_build_object('field', f.slug, 'format', m.format)
from public.mentorship_offers m join public.mentorship_offer_translations t on t.offer_id = m.id
join public.scientist_profiles s on s.id = m.scientist_id join public.scientific_fields f on f.id = m.field_id
where m.deleted_at is null
union all
select p.id, 'research-program', t.locale, t.title, t.summary,
  '/' || t.locale || '/research-program/' || t.slug, '/admin/programs/research-program/' || p.id,
  p.status = 'published' and s.status = 'verified' and s.deleted_at is null and f.is_active
    and exists(select 1 from public.scientist_profile_translations st where st.scientist_profile_id = s.id and st.locale = t.locale),
  public.has_permission('research_program.manage'), p.updated_at, p.updated_at, t.search_document,
  jsonb_build_object('field', f.slug, 'format', p.format)
from public.research_programs p join public.research_program_translations t on t.program_id = p.id
join public.scientist_profiles s on s.id = p.coordinator_id join public.scientific_fields f on f.id = p.field_id
where p.deleted_at is null
union all
select e.id, 'events', t.locale, t.title, t.summary,
  '/' || t.locale || '/events/' || t.slug, '/admin/programs/events/' || e.id,
  e.status in ('published', 'cancelled') and e.published_at <= now(), public.has_permission('events.manage'),
  e.starts_at, e.updated_at, t.search_document,
  jsonb_build_object('kind', e.kind, 'format', e.format, 'ends_at', e.ends_at)
from public.events e join public.event_translations t on t.event_id = e.id where e.deleted_at is null
union all
select p.id, 'publications', st.locale, p.title, p.journal,
  '/' || st.locale || '/publications/' || p.id, '/admin/science/publications?edit=' || p.id,
  p.status = 'published' and p.published_at <= now() and s.status = 'verified' and s.deleted_at is null,
  public.has_permission('publications.manage'), p.updated_at, p.updated_at, p.search_document,
  jsonb_build_object('year', p.year)
from public.publications p join public.scientist_profiles s on s.id = p.scientist_id
join public.scientist_profile_translations st on st.scientist_profile_id = s.id where p.deleted_at is null
union all
select o.id, 'organizations', t.locale, t.name, coalesce(t.city, ''),
  '/' || t.locale || '/scientists?organization=' || o.slug, '/admin/science/scientists/taxonomy',
  o.is_active, public.has_permission('scientists.edit'), o.updated_at, o.updated_at, t.search_document, '{}'::jsonb
from public.scientific_organizations o join public.scientific_organization_translations t on t.organization_id = o.id
union all
select p.id, 'users', 'ru', coalesce(p.display_name, p.id::text), '', null, null, false, public.has_permission('users.manage'),
  p.created_at, p.created_at, p.search_document, '{}'::jsonb from public.profiles p
union all
select m.id, 'media', 'ru', m.file_name, '', null, '/admin/content/media/' || m.id, false,
  public.has_permission('media.view'), m.created_at, m.updated_at, m.search_document, '{}'::jsonb
from public.media_assets m where m.deleted_at is null
union all
select a.id, 'mentorship-applications', a.locale, a.full_name, '', null,
  '/admin/programs/mentorship/applications?application=' || a.id, false, public.has_permission('mentorship.manage'),
  a.created_at, a.updated_at, a.search_document, '{}'::jsonb
from public.mentorship_applications a where a.deleted_at is null
union all
select a.id, 'program-applications', a.locale, a.full_name, '', null,
  '/admin/programs/research-program/applications?application=' || a.id, false, public.has_permission('research_program.manage'),
  a.created_at, a.updated_at, a.search_document, '{}'::jsonb
from public.research_program_applications a where a.deleted_at is null;

revoke all on public.search_entries from public, anon, authenticated, service_role;
revoke all on function public.search_vector(text, text, text) from public;
-- Generated expressions also run during the existing service-role save RPCs.
grant execute on function public.search_vector(text, text, text) to anon, authenticated, service_role;

create function public.search_public(p_locale text, p_query text default '', p_section text default '',
  p_filters jsonb default '{}', p_page integer default 1, p_page_size integer default 12)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_query tsquery; v_simple tsquery; v_result jsonb;
begin
  if p_locale is null or p_locale not in ('ru', 'kk', 'en') or p_query is null or length(p_query) > 120
    or p_page is null or p_page not between 1 and 1000000 or p_page_size is null or p_page_size not between 1 and 60
    or p_section is null or p_section not in ('', 'journal', 'scientists', 'research', 'projects', 'publications', 'mentorship', 'research-program', 'events', 'organizations')
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
      and not exists(select 1 from jsonb_each_text(p_filters) f where f.key <> 'period'
        and f.value not in ('', 'all') and not coalesce(e.attributes -> f.key @> to_jsonb(f.value), false))
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

create function public.search_admin(p_query text, p_section text default '', p_page integer default 1, p_page_size integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_query tsquery; v_english tsquery; v_simple tsquery; v_result jsonb;
begin
  if auth.uid() is null or not public.has_permission('admin.access') then raise exception 'forbidden'; end if;
  if p_query is null or length(p_query) > 120 or p_section is null or p_page is null or p_page not between 1 and 1000000
    or p_page_size is null or p_page_size not between 1 and 60 then raise exception 'invalid_input'; end if;
  v_query := websearch_to_tsquery('pg_catalog.russian'::regconfig, btrim(p_query));
  v_english := websearch_to_tsquery('pg_catalog.english'::regconfig, btrim(p_query));
  v_simple := websearch_to_tsquery('pg_catalog.simple'::regconfig, btrim(p_query));
  with matched as (
    select distinct on (e.section, e.id) e.*, ts_rank(e.search_document, v_query || v_english || v_simple) rank
    from public.search_entries e where e.admin_allowed and (p_section = '' or e.section = p_section)
      and btrim(p_query) <> '' and e.search_document @@ (v_query || v_english || v_simple)
    order by e.section, e.id, rank desc, (e.locale = 'ru') desc, e.locale
  ), page as (
    select * from matched order by rank desc, updated_at desc, section, id
    limit p_page_size offset (p_page::bigint - 1) * p_page_size
  ) select jsonb_build_object('total', (select count(*) from matched), 'page', p_page, 'pageSize', p_page_size,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'section', section, 'locale', locale,
      'title', title, 'summary', summary, 'href', admin_href)) from page), '[]'::jsonb)) into v_result;
  return v_result;
end $$;

revoke all on function public.search_public(text, text, text, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.search_admin(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_public(text, text, text, jsonb, integer, integer) to anon, authenticated;
grant execute on function public.search_admin(text, text, integer, integer) to authenticated;
