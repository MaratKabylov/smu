-- Editorial credits are separate from articles.author_id (the security owner).
create table public.article_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ru text not null, name_kk text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.article_types(slug, name_ru, name_kk) values
  ('article', 'Статья', 'Мақала'), ('news', 'Новость', 'Жаңалық'),
  ('interview', 'Интервью', 'Сұхбат'), ('announcement', 'Анонс', 'Хабарландыру');
alter table public.articles alter column content_type drop default;
alter table public.articles alter column content_type type text using content_type::text;
alter table public.articles alter column content_type set default 'article';
alter table public.articles add constraint articles_content_type_fkey foreign key(content_type)
  references public.article_types(slug) on update cascade on delete restrict;

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  name_ru text not null, name_kk text not null,
  bio_ru text, bio_kk text, organization text, position text, website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (website_url is null or (website_url ~* '^https?://' and website_url !~ '[[:space:][:cntrl:]]'))
);
create table public.article_authors (
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  role text not null check (role in ('author', 'coauthor', 'editor', 'translator')),
  primary key(article_id, author_id), unique(article_id, sort_order)
);
create index article_authors_author_idx on public.article_authors(author_id);
create table public.article_category_links (
  article_id uuid not null references public.articles(id) on delete cascade,
  category_id uuid not null references public.article_categories(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  primary key(article_id, category_id), unique(article_id, sort_order)
);
create index article_category_links_category_idx on public.article_category_links(category_id);
insert into public.authors(profile_id, name_ru, name_kk)
  select distinct p.id, coalesce(nullif(btrim(p.display_name), ''), 'Автор'),
    coalesce(nullif(btrim(p.display_name), ''), 'Автор')
  from public.profiles p join public.articles a on a.author_id = p.id;
insert into public.article_authors(article_id, author_id, sort_order, role)
  select a.id, au.id, 0, 'author' from public.articles a join public.authors au on au.profile_id = a.author_id;
insert into public.article_category_links(article_id, category_id, sort_order)
  select id, category_id, 0 from public.articles where category_id is not null;

create trigger authors_updated_at before update on public.authors
  for each row execute function public.set_updated_at();
create trigger article_types_updated_at before update on public.article_types
  for each row execute function public.set_updated_at();

alter table public.authors enable row level security;
alter table public.article_types enable row level security;
alter table public.article_authors enable row level security;
alter table public.article_category_links enable row level security;
revoke all on public.authors, public.article_types, public.article_authors, public.article_category_links
  from public, anon, authenticated, service_role;
-- Public credits never require reading profile identities, email or user roles.
grant select(id, name_ru, name_kk, bio_ru, bio_kk, organization, position, website_url, is_active)
  on public.authors to anon;
grant select on public.authors to authenticated;
grant select on public.article_types, public.article_authors, public.article_category_links to anon, authenticated;
create policy authors_read_editorial on public.authors for select to authenticated using (
  public.has_permission('admin.access') and (public.has_permission('articles.create')
    or public.has_permission('articles.edit_own') or public.has_permission('articles.edit_any')
    or public.has_permission('articles.review') or public.has_permission('articles.publish'))
);
create policy authors_read_published on public.authors for select to anon, authenticated using (
  exists (select 1 from public.article_authors aa join public.articles a on a.id = aa.article_id
    where aa.author_id = authors.id and a.status = 'published' and a.deleted_at is null and a.published_at <= now())
);
create policy article_authors_read_visible on public.article_authors for select to anon, authenticated
  using (exists (select 1 from public.articles a where a.id = article_id));
create policy article_category_links_read_visible on public.article_category_links for select to anon, authenticated
  using (exists (select 1 from public.articles a where a.id = article_id));
create policy article_types_read on public.article_types for select to anon, authenticated using (
  is_active or exists (select 1 from public.articles a where a.content_type = slug
    and a.status = 'published' and a.deleted_at is null and a.published_at <= now())
);
create policy article_types_read_editorial on public.article_types for select to authenticated using (
  public.has_permission('admin.access') and (public.has_permission('articles.create')
    or public.has_permission('articles.edit_own') or public.has_permission('articles.edit_any')
    or public.has_permission('articles.review') or public.has_permission('articles.publish'))
);
create policy article_categories_read_used on public.article_categories for select to anon, authenticated using (
  exists (select 1 from public.article_category_links ac join public.articles a on a.id = ac.article_id
    where ac.category_id = article_categories.id and a.status = 'published' and a.deleted_at is null and a.published_at <= now())
);
create policy article_categories_read_all_editorial on public.article_categories for select to authenticated using (
  public.has_permission('admin.access') and (public.has_permission('articles.edit_own')
    or public.has_permission('articles.review') or public.has_permission('articles.publish'))
);

-- Directory management is permission-checked inside the database as well as the service.
create function public.save_article_author(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_id uuid; v_old jsonb;
  v_profile uuid := nullif(p_input->>'profileId', '')::uuid;
begin
  if not public.has_permission('articles.edit_any') then raise exception 'forbidden'; end if;
  if coalesce(length(btrim(p_input->>'nameRu')), 0) not between 2 and 160
    or coalesce(length(btrim(p_input->>'nameKk')), 0) not between 2 and 160
    or length(coalesce(p_input->>'bioRu', '')) > 2000 or length(coalesce(p_input->>'bioKk', '')) > 2000
    or length(coalesce(p_input->>'organization', '')) > 240 or length(coalesce(p_input->>'position', '')) > 240
    or jsonb_typeof(p_input->'isActive') is distinct from 'boolean'
    or (nullif(p_input->>'websiteUrl', '') is not null and (p_input->>'websiteUrl' !~* '^https?://'
      or p_input->>'websiteUrl' ~ '[[:space:][:cntrl:]]' or length(p_input->>'websiteUrl') > 500))
    then raise exception 'invalid_input'; end if;
  if v_profile is not null and not exists(select 1 from public.profiles where id = v_profile)
    then raise exception 'invalid_reference'; end if;
  if p_id is null then
    insert into public.authors(profile_id, name_ru, name_kk) values(v_profile, btrim(p_input->>'nameRu'), btrim(p_input->>'nameKk')) returning id into v_id;
  else
    select to_jsonb(a) into v_old from public.authors a where id = p_id for update;
    if not found then raise exception 'not_found'; end if;
    v_id := p_id;
  end if;
  update public.authors set profile_id = v_profile, name_ru = btrim(p_input->>'nameRu'), name_kk = btrim(p_input->>'nameKk'),
    bio_ru = nullif(p_input->>'bioRu', ''), bio_kk = nullif(p_input->>'bioKk', ''),
    organization = nullif(p_input->>'organization', ''), position = nullif(p_input->>'position', ''),
    website_url = nullif(p_input->>'websiteUrl', ''), is_active = (p_input->>'isActive')::boolean where id = v_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values(v_actor, 'author', v_id, case when p_id is null then 'author.create' else 'author.update' end, v_old, p_input);
  return v_id;
end;
$$;

create function public.list_article_author_profiles() returns table(id uuid, display_name text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_smu_session();
  if not public.has_permission('articles.edit_any') then raise exception 'forbidden'; end if;
  return query select p.id, p.display_name from public.profiles p order by p.display_name, p.id;
end;
$$;

create function public.save_article_taxonomy(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_id uuid; v_table text; v_old jsonb;
begin
  if not public.has_permission('articles.edit_any') then raise exception 'forbidden'; end if;
  v_table := case p_input->>'kind' when 'category' then 'article_categories' when 'tag' then 'article_tags' when 'type' then 'article_types' end;
  if v_table is null or coalesce(p_input->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(length(p_input->>'slug'), 0) not between 2 and 160
    or coalesce(length(btrim(p_input->>'nameRu')), 0) not between 2 and 120
    or coalesce(length(btrim(p_input->>'nameKk')), 0) not between 2 and 120
    or (p_id is not null and jsonb_typeof(p_input->'isActive') is distinct from 'boolean')
    then raise exception 'invalid_input'; end if;
  if p_id is null then
    execute format('insert into public.%I(slug, name_ru, name_kk) values($1, $2, $3) returning id', v_table)
      into v_id using p_input->>'slug', btrim(p_input->>'nameRu'), btrim(p_input->>'nameKk');
  else
    execute format('select to_jsonb(t) from public.%I t where id = $1 for update', v_table) into v_old using p_id;
    if v_old is null then raise exception 'not_found'; end if;
    -- Stable codes keep saved revision references and URLs meaningful.
    if p_input->>'slug' is distinct from v_old->>'slug' then raise exception 'invalid_input'; end if;
    execute format('update public.%I set name_ru = $1, name_kk = $2, is_active = $3 where id = $4', v_table)
      using btrim(p_input->>'nameRu'), btrim(p_input->>'nameKk'), (p_input->>'isActive')::boolean, p_id;
    v_id := p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values(v_actor, 'article_' || (p_input->>'kind'), v_id, 'article.' || (p_input->>'kind') || case when p_id is null then '.create' else '.update' end, v_old, p_input);
  return v_id;
end;
$$;
create or replace function public.create_article_taxonomy(p_input jsonb) returns uuid
language sql security definer set search_path = '' as $$ select public.save_article_taxonomy(null, p_input); $$;
revoke all on function public.save_article_author(uuid, jsonb), public.list_article_author_profiles(), public.save_article_taxonomy(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_article_author(uuid, jsonb), public.list_article_author_profiles(), public.save_article_taxonomy(uuid, jsonb)
  to authenticated;

create or replace function public.save_article(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session(); v_id uuid;
  v_old public.articles%rowtype; v_locale text; v_t jsonb; v_old_slug text;
  v_category uuid; v_categories jsonb; v_authors jsonb; v_default_author uuid; v_link jsonb;
  v_doc jsonb; v_body text; v_image jsonb;
  v_cover uuid := nullif(p_input->>'coverMediaId', '')::uuid;
begin
  if p_id is null then
    if not public.has_permission('articles.create') then raise exception 'forbidden'; end if;
    insert into public.articles(author_id) values (v_actor) returning id into v_id;
  else
    select * into v_old from public.articles where id = p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    if not (public.has_permission('articles.edit_any')
      or (v_old.author_id = v_actor and v_old.status = 'draft' and public.has_permission('articles.edit_own')))
      or (v_old.status = 'archived' and not public.has_permission('articles.publish'))
      then raise exception 'forbidden'; end if;
    if (p_input->>'expectedVersion')::integer is distinct from v_old.content_version then raise exception 'stale_version'; end if;
    v_id := p_id;
  end if;
  -- Omitted fields support old clients and pre-012 snapshots. An explicit empty
  -- array clears credits/categories, while omitted update credits stay unchanged.
  v_categories := case when p_input ? 'categoryIds' then p_input->'categoryIds'
    when nullif(p_input->>'categoryId', '') is not null then jsonb_build_array(p_input->>'categoryId') else '[]'::jsonb end;
  if p_input ? 'authors' then v_authors := p_input->'authors';
  elsif p_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('authorId', author_id, 'role', role) order by sort_order), '[]'::jsonb)
      into v_authors from public.article_authors where article_id = v_id;
  else
    insert into public.authors(profile_id, name_ru, name_kk)
      select v_actor, coalesce(nullif(btrim(display_name), ''), 'Автор'), coalesce(nullif(btrim(display_name), ''), 'Автор')
      from public.profiles where id = v_actor on conflict(profile_id) do nothing;
    select id into v_default_author from public.authors where profile_id = v_actor;
    v_authors := jsonb_build_array(jsonb_build_object('authorId', v_default_author, 'role', 'author'));
  end if;
  if jsonb_typeof(v_categories) is distinct from 'array' or jsonb_array_length(v_categories) > 20
    or jsonb_typeof(v_authors) is distinct from 'array' or jsonb_array_length(v_authors) > 20
    or jsonb_typeof(p_input->'tagIds') is distinct from 'array' or jsonb_array_length(p_input->'tagIds') > 30
    then raise exception 'invalid_input'; end if;
  if (select count(*) <> count(distinct value) from jsonb_array_elements_text(v_categories))
    or (select count(*) <> count(distinct value->>'authorId') from jsonb_array_elements(v_authors))
    or (select count(*) <> count(distinct value) from jsonb_array_elements_text(p_input->'tagIds'))
    then raise exception 'invalid_input'; end if;
  for v_link in select value from jsonb_array_elements(v_authors) loop
    if jsonb_typeof(v_link) is distinct from 'object' or coalesce(v_link->>'role', '') not in ('author', 'coauthor', 'editor', 'translator')
      or coalesce(v_link->>'authorId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then raise exception 'invalid_input'; end if;
  end loop;
  -- Share locks serialize deactivation against a save. Inactive selections can
  -- be kept on the same article but cannot be newly attached/restored.
  perform 1 from public.article_types where slug = p_input->>'contentType' for share;
  perform 1 from public.article_categories where id in (select value::uuid from jsonb_array_elements_text(v_categories)) for share;
  perform 1 from public.authors where id in (select (value->>'authorId')::uuid from jsonb_array_elements(v_authors)) for share;
  if not exists(select 1 from public.article_types where slug = p_input->>'contentType' and (is_active or slug = v_old.content_type))
    or exists(select 1 from jsonb_array_elements_text(v_categories) c where not exists(
      select 1 from public.article_categories where id = c.value::uuid and (is_active or exists(
        select 1 from public.article_category_links where article_id = p_id and category_id = c.value::uuid))))
    or exists(select 1 from jsonb_array_elements(v_authors) au where not exists(
      select 1 from public.authors where id = (au.value->>'authorId')::uuid and (is_active or exists(
        select 1 from public.article_authors where article_id = p_id and author_id = (au.value->>'authorId')::uuid))))
    or (v_cover is not null and not exists(select 1 from public.media_assets where id = v_cover
      and status = 'ready' and deleted_at is null and storage_bucket = 'article-media' and mime_type like 'image/%'))
    or exists(select 1 from jsonb_array_elements_text(p_input->'tagIds') t where not exists(
      select 1 from public.article_tags where id = t.value::uuid and is_active)) then raise exception 'invalid_reference'; end if;
  v_category := (v_categories->>0)::uuid;
  update public.articles set category_id = v_category, cover_media_id = v_cover,
    content_type = p_input->>'contentType',
    status = 'draft', approved_version = null, updated_by = v_actor,
    content_version = case when p_id is null then 1 else content_version + 1 end
    where id = v_id;
  foreach v_locale in array array['ru', 'kk'] loop
    v_t := p_input->v_locale;
    v_doc := coalesce(nullif(v_t->'contentJson', 'null'::jsonb), public.smu_plain_text_document(v_t->>'body'));
    if octet_length(v_doc::text) > 1000000 then raise exception 'invalid_input'; end if;
    v_body := public.validate_smu_rich_text(v_doc);
    v_t := jsonb_set(v_t, '{body}', to_jsonb(v_body));
    for v_image in select value from jsonb_path_query(v_doc, '$.** ? (@.type == "image")') as images(value) loop
      if not exists (select 1 from public.media_assets where id = (v_image->'attrs'->>'mediaId')::uuid
        and status = 'ready' and deleted_at is null and storage_bucket = 'article-media' and mime_type like 'image/%')
        then raise exception 'invalid_reference'; end if;
    end loop;
    if v_t is null or length(btrim(v_t->>'title')) not between 3 and 240
      or length(btrim(v_t->>'excerpt')) not between 10 and 1000
      or length(btrim(v_t->>'body')) not between 20 and 200000
      or v_t->>'title' is null or v_t->>'excerpt' is null or v_t->>'body' is null
      or length(coalesce(v_t->>'seoTitle', '')) > 70 or length(coalesce(v_t->>'seoDescription', '')) > 170
      then raise exception 'invalid_input'; end if;
    select slug into v_old_slug from public.article_translations where article_id = v_id and locale = v_locale;
    perform public.preserve_smu_slug('article', v_id, v_locale, v_old_slug, v_t->>'slug', v_old.first_published_at is not null);
    insert into public.article_translations(article_id, locale, title, slug, excerpt, body, content_json, seo_title, seo_description)
      values (v_id, v_locale, btrim(v_t->>'title'), v_t->>'slug', btrim(v_t->>'excerpt'), v_body, v_doc,
        nullif(v_t->>'seoTitle', ''), nullif(v_t->>'seoDescription', ''))
      on conflict (article_id, locale) do update set title = excluded.title, slug = excluded.slug,
        excerpt = excluded.excerpt, body = excluded.body, content_json = excluded.content_json, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
  end loop;
  delete from public.media_usages where entity_type = 'article' and entity_id = v_id and field_name like 'content_%';
  insert into public.media_usages(media_asset_id, entity_type, entity_id, field_name)
    select distinct (image.value->'attrs'->>'mediaId')::uuid, 'article', v_id, 'content_' || t.locale
    from public.article_translations t
    cross join lateral jsonb_path_query(t.content_json, '$.** ? (@.type == "image")') image(value)
    where t.article_id = v_id;
  delete from public.article_tag_links where article_id = v_id;
  insert into public.article_tag_links(article_id, tag_id)
    select v_id, value::uuid from jsonb_array_elements_text(p_input->'tagIds');
  delete from public.article_category_links where article_id = v_id;
  insert into public.article_category_links(article_id, category_id, sort_order)
    select v_id, value::uuid, position - 1 from jsonb_array_elements_text(v_categories) with ordinality as c(value, position);
  delete from public.article_authors where article_id = v_id;
  insert into public.article_authors(article_id, author_id, sort_order, role)
    select v_id, (value->>'authorId')::uuid, position - 1, value->>'role'
    from jsonb_array_elements(v_authors) with ordinality as au(value, position);
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', v_id, case when p_id is null then 'article.create' else 'article.update' end,
      case when p_id is null then null else to_jsonb(v_old) end,
      jsonb_build_object('status', 'draft', 'categoryId', v_category, 'coverMediaId', v_cover,
        'tagIds', p_input->'tagIds', 'categoryIds', v_categories, 'authors', v_authors, 'contentType', p_input->>'contentType', 'translations', jsonb_build_object(
          'ru', jsonb_build_object('title', p_input->'ru'->>'title', 'slug', p_input->'ru'->>'slug'),
          'kk', jsonb_build_object('title', p_input->'kk'->>'title', 'slug', p_input->'kk'->>'slug'))));
  return v_id;
end;
$$;


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

update public.article_revisions r set snapshot = snapshot || jsonb_build_object(
  'categoryIds', case when nullif(snapshot->>'categoryId', '') is null then '[]'::jsonb else jsonb_build_array(snapshot->>'categoryId') end,
  'authors', coalesce((select jsonb_build_array(jsonb_build_object('authorId', au.id, 'role', 'author'))
    from public.articles a join public.authors au on au.profile_id = a.author_id where a.id = r.article_id), '[]'::jsonb)
);
comment on column public.articles.author_id is 'Security owner; editorial credits live in article_authors and do not confer access.';
comment on column public.articles.category_id is 'Compatibility primary category; synchronized with the first article_category_links entry by save_article.';
