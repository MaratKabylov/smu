-- Complete the scientist directories: translated values are the canonical
-- application source, fields can form a hierarchy, and organizations have a
-- typed classification. Legacy RU/KK columns remain synchronized so upgrades
-- do not break older readers while the application moves to translations.

create type public.scientific_organization_type as enum (
  'university', 'research_center', 'hospital', 'company',
  'government', 'ngo', 'school', 'other'
);

alter table public.scientific_organizations
  add column type public.scientific_organization_type not null default 'other';

alter table public.scientific_fields
  add column parent_id uuid references public.scientific_fields(id) on delete restrict,
  add constraint scientific_fields_parent_not_self check (parent_id is null or parent_id <> id);

create index scientific_fields_parent_idx on public.scientific_fields(parent_id);
create index scientific_organizations_type_idx on public.scientific_organizations(type, is_active);

-- A parent filter includes records assigned to any active descendant. The
-- search view keeps direct assignments; expansion happens only for a selected
-- field, so unfiltered catalog queries retain their existing plan.
create or replace function public.search_public(p_locale text, p_query text default '', p_section text default '',
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

create function public.save_scientist_taxonomy(
  p_kind text,
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_input jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session();
  v_id uuid := p_id;
  v_slug text := btrim(coalesce(p_input->>'slug', ''));
  v_name_ru text := btrim(coalesce(p_input->>'nameRu', ''));
  v_name_kk text := btrim(coalesce(p_input->>'nameKk', ''));
  v_name_en text := nullif(btrim(p_input->>'nameEn'), '');
  v_city_ru text := nullif(btrim(p_input->>'cityRu'), '');
  v_city_kk text := nullif(btrim(p_input->>'cityKk'), '');
  v_city_en text := nullif(btrim(p_input->>'cityEn'), '');
  v_website text := nullif(btrim(p_input->>'websiteUrl'), '');
  v_parent uuid;
  v_type public.scientific_organization_type;
  v_active boolean;
  v_old jsonb;
  v_updated_at timestamptz;
begin
  if not public.has_permission('scientists.edit') then raise exception 'forbidden'; end if;
  if coalesce(p_kind, '') not in ('field', 'organization') or p_input is null
    or coalesce(jsonb_typeof(p_input), '') <> 'object' or pg_column_size(p_input) > 10000
    or coalesce(p_input->>'kind', '') <> p_kind
    or coalesce(jsonb_typeof(p_input->'slug'), '') <> 'string'
    or coalesce(jsonb_typeof(p_input->'nameRu'), '') <> 'string'
    or coalesce(jsonb_typeof(p_input->'nameKk'), '') <> 'string'
    or (p_input ? 'nameEn' and jsonb_typeof(p_input->'nameEn') not in ('string', 'null'))
    or coalesce(jsonb_typeof(p_input->'isActive'), '') <> 'boolean'
    or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) not between 2 and 160
    or length(v_name_ru) not between 2 and 200 or length(v_name_kk) not between 2 and 200
    or (v_name_en is not null and length(v_name_en) not between 2 and 200)
    then raise exception 'invalid_input'; end if;
  v_active := (p_input->>'isActive')::boolean;

  if p_kind = 'field' then
    if exists(select 1 from jsonb_object_keys(p_input) key where key not in
      ('kind','slug','nameRu','nameKk','nameEn','parentId','isActive','expectedUpdatedAt'))
      or (p_input ? 'parentId' and jsonb_typeof(p_input->'parentId') not in ('string', 'null'))
      then raise exception 'invalid_input'; end if;
    if p_input->>'parentId' is not null then
      begin v_parent := (p_input->>'parentId')::uuid;
      exception when invalid_text_representation then raise exception 'invalid_input'; end;
    end if;
    if v_city_ru is not null or v_city_kk is not null or v_city_en is not null
      or v_website is not null or p_input->>'organizationType' is not null
      then raise exception 'invalid_input'; end if;
    if v_parent is not null then
      perform 1 from public.scientific_fields where id = v_parent and is_active for share;
      if not found then raise exception 'invalid_reference'; end if;
    end if;

    if v_id is null then
      if p_expected_updated_at is not null then raise exception 'invalid_input'; end if;
      insert into public.scientific_fields(slug, name_ru, name_kk, parent_id, is_active)
        values(v_slug, v_name_ru, v_name_kk, v_parent, v_active) returning id into v_id;
    else
      select to_jsonb(f), f.updated_at into v_old, v_updated_at
        from public.scientific_fields f where f.id = v_id for update;
      if not found then raise exception 'not_found'; end if;
      if p_expected_updated_at is null or p_expected_updated_at is distinct from v_updated_at then raise exception 'stale_version'; end if;
      if v_parent = v_id or (v_parent is not null and exists(
        with recursive descendants as (
          select id from public.scientific_fields where parent_id = v_id
          union all
          select child.id from public.scientific_fields child join descendants parent on child.parent_id = parent.id
        ) select 1 from descendants where id = v_parent
      )) then raise exception 'invalid_reference'; end if;
      if not v_active and exists(select 1 from public.scientific_fields where parent_id = v_id and is_active)
        then raise exception 'invalid_transition'; end if;
      update public.scientific_fields set slug = v_slug, name_ru = v_name_ru, name_kk = v_name_kk,
        parent_id = v_parent, is_active = v_active where id = v_id;
    end if;

    insert into public.scientific_field_translations(field_id, locale, name) values
      (v_id, 'ru', v_name_ru), (v_id, 'kk', v_name_kk)
      on conflict(field_id, locale) do update set name = excluded.name;
    if v_name_en is null then delete from public.scientific_field_translations where field_id = v_id and locale = 'en';
    else insert into public.scientific_field_translations(field_id, locale, name) values(v_id, 'en', v_name_en)
      on conflict(field_id, locale) do update set name = excluded.name; end if;
  else
    if exists(select 1 from jsonb_object_keys(p_input) key where key not in
      ('kind','slug','nameRu','nameKk','nameEn','cityRu','cityKk','cityEn','websiteUrl','organizationType','isActive','expectedUpdatedAt'))
      or (p_input ? 'cityRu' and jsonb_typeof(p_input->'cityRu') not in ('string', 'null'))
      or (p_input ? 'cityKk' and jsonb_typeof(p_input->'cityKk') not in ('string', 'null'))
      or (p_input ? 'cityEn' and jsonb_typeof(p_input->'cityEn') not in ('string', 'null'))
      or (p_input ? 'websiteUrl' and jsonb_typeof(p_input->'websiteUrl') not in ('string', 'null'))
      or coalesce(jsonb_typeof(p_input->'organizationType'), '') <> 'string'
      or p_input->>'parentId' is not null
      or length(coalesce(v_city_ru, '')) > 120 or length(coalesce(v_city_kk, '')) > 120
      or length(coalesce(v_city_en, '')) > 120
      or (v_name_en is null and v_city_en is not null)
      or (v_website is not null and (length(v_website) > 500 or v_website !~* '^https?://[^[:space:]]+$'))
      or coalesce(p_input->>'organizationType', '') not in ('university','research_center','hospital','company','government','ngo','school','other')
      then raise exception 'invalid_input'; end if;
    v_type := (p_input->>'organizationType')::public.scientific_organization_type;

    if v_id is null then
      if p_expected_updated_at is not null then raise exception 'invalid_input'; end if;
      insert into public.scientific_organizations(slug, name_ru, name_kk, city_ru, city_kk, website_url, type, is_active)
        values(v_slug, v_name_ru, v_name_kk, v_city_ru, v_city_kk, v_website, v_type, v_active) returning id into v_id;
    else
      select to_jsonb(o), o.updated_at into v_old, v_updated_at
        from public.scientific_organizations o where o.id = v_id for update;
      if not found then raise exception 'not_found'; end if;
      if p_expected_updated_at is null or p_expected_updated_at is distinct from v_updated_at then raise exception 'stale_version'; end if;
      update public.scientific_organizations set slug = v_slug, name_ru = v_name_ru, name_kk = v_name_kk,
        city_ru = v_city_ru, city_kk = v_city_kk, website_url = v_website, type = v_type, is_active = v_active
        where id = v_id;
    end if;

    insert into public.scientific_organization_translations(organization_id, locale, name, city) values
      (v_id, 'ru', v_name_ru, v_city_ru), (v_id, 'kk', v_name_kk, v_city_kk)
      on conflict(organization_id, locale) do update set name = excluded.name, city = excluded.city;
    if v_name_en is null then delete from public.scientific_organization_translations where organization_id = v_id and locale = 'en';
    else insert into public.scientific_organization_translations(organization_id, locale, name, city)
      values(v_id, 'en', v_name_en, v_city_en)
      on conflict(organization_id, locale) do update set name = excluded.name, city = excluded.city; end if;
  end if;

  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values(v_actor, case when p_kind = 'field' then 'scientific_field' else 'scientific_organization' end,
      v_id, 'scientist.' || p_kind || case when p_id is null then '.create' else '.update' end,
      v_old, p_input - 'expectedUpdatedAt');
  return v_id;
exception
  when unique_violation then raise exception 'slug_conflict';
end $$;

revoke all on function public.save_scientist_taxonomy(text, uuid, timestamptz, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_scientist_taxonomy(text, uuid, timestamptz, jsonb) to authenticated;
revoke all on function public.create_scientist_taxonomy(jsonb) from public, anon, authenticated, service_role;

comment on column public.scientific_fields.parent_id is 'Optional parent in the acyclic scientific-field hierarchy.';
comment on column public.scientific_organizations.type is 'Stable organization classification used by catalog filters and structured data.';
comment on function public.save_scientist_taxonomy(text, uuid, timestamptz, jsonb) is 'Atomic create/update of translated scientist directories with optimistic locking and audit.';
