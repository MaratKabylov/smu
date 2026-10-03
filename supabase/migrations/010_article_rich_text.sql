-- Structured editorial content. Keep body as a derived search/reading-time field.
create function public.smu_plain_text_document(p_text text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('type', 'doc', 'content', coalesce(jsonb_agg(
    case when line = '' then jsonb_build_object('type', 'paragraph')
    else jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', line))) end
    order by position), '[]'::jsonb))
  from unnest(string_to_array(p_text, E'\n')) with ordinality as lines(line, position);
$$;

-- Validate a deliberately bounded subset of TipTap JSON, including direct RPC calls.
create function public.validate_smu_rich_text(p_node jsonb, p_parent text default null, p_depth integer default 0)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_type text := p_node->>'type'; v_child jsonb; v_mark jsonb;
  v_allowed text[]; v_result text := ''; v_first boolean := true; v_separator text := '';
begin
  if p_depth > 20 or jsonb_typeof(p_node) is distinct from 'object' or v_type is null
    or exists (select 1 from jsonb_object_keys(p_node) k where k not in ('type', 'text', 'content', 'attrs', 'marks'))
    then raise exception 'invalid_input'; end if;
  v_allowed := case
    when p_parent is null then array['doc']
    when p_parent in ('doc', 'blockquote', 'listItem') then array['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'codeBlock', 'horizontalRule', 'image']
    when p_parent in ('bulletList', 'orderedList') then array['listItem']
    when p_parent = 'codeBlock' then array['text']
    else array['text', 'hardBreak'] end;
  if not (v_type = any(v_allowed)) then raise exception 'invalid_input'; end if;
  if p_node ? 'attrs' and jsonb_typeof(p_node->'attrs') is distinct from 'object' then raise exception 'invalid_input'; end if;
  if exists (select 1 from jsonb_each(coalesce(p_node->'attrs', '{}'::jsonb)) a
    where jsonb_typeof(a.value) not in ('string', 'number', 'null')) then raise exception 'invalid_input'; end if;
  if v_type = 'text' then
    if jsonb_typeof(p_node->'text') is distinct from 'string' or length(p_node->>'text') = 0
      then raise exception 'invalid_input'; end if;
    v_result := p_node->>'text';
  elsif p_node ? 'text' then raise exception 'invalid_input'; end if;
  if v_type in ('text', 'hardBreak', 'horizontalRule', 'image') and p_node ? 'content'
    then raise exception 'invalid_input'; end if;
  if v_type = 'heading' and coalesce(p_node->'attrs'->>'level', '') not in ('2', '3', '4')
    then raise exception 'invalid_input'; end if;
  if v_type = 'image' and (coalesce(p_node->'attrs'->>'mediaId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (nullif(p_node->'attrs'->>'src', '') is not null and (p_node->'attrs'->>'src' !~* '^https?://' or p_node->'attrs'->>'src' ~ '[[:space:][:cntrl:]]')))
    then raise exception 'invalid_input'; end if;
  if p_node ? 'marks' then
    if v_type <> 'text' or jsonb_typeof(p_node->'marks') is distinct from 'array' or jsonb_array_length(p_node->'marks') > 8
      then raise exception 'invalid_input'; end if;
    for v_mark in select value from jsonb_array_elements(p_node->'marks') loop
      if jsonb_typeof(v_mark) is distinct from 'object' or coalesce(v_mark->>'type', '') not in ('bold', 'italic', 'strike', 'underline', 'code', 'link')
        or exists (select 1 from jsonb_object_keys(v_mark) k where k not in ('type', 'attrs'))
        then raise exception 'invalid_input'; end if;
      if v_mark ? 'attrs' and jsonb_typeof(v_mark->'attrs') is distinct from 'object' then raise exception 'invalid_input'; end if;
      if exists (select 1 from jsonb_each(coalesce(v_mark->'attrs', '{}'::jsonb)) a where jsonb_typeof(a.value) not in ('string', 'number', 'null')) then raise exception 'invalid_input'; end if;
      if v_mark->>'type' = 'link' and (coalesce(v_mark->'attrs'->>'href', '') !~* '^(https?://|mailto:)'
        or v_mark->'attrs'->>'href' ~ '[[:space:][:cntrl:]]') then raise exception 'invalid_input'; end if;
    end loop;
  end if;
  if v_type = 'hardBreak' then return E'\n'; end if;
  if v_type = 'image' then return ''; end if;
  if v_type in ('doc', 'blockquote', 'bulletList', 'orderedList', 'listItem') then v_separator := E'\n'; end if;
  if p_node ? 'content' then
    if jsonb_typeof(p_node->'content') is distinct from 'array' or jsonb_array_length(p_node->'content') > 10000
      then raise exception 'invalid_input'; end if;
    for v_child in select value from jsonb_array_elements(p_node->'content') loop
      if not v_first then v_result := v_result || v_separator; end if;
      v_result := v_result || public.validate_smu_rich_text(v_child, v_type, p_depth + 1);
      v_first := false;
    end loop;
  end if;
  return v_result;
end;
$$;

alter table public.article_translations add column content_json jsonb;
update public.article_translations set content_json = public.smu_plain_text_document(body);
alter table public.article_translations alter column content_json set not null;

-- Keep ordinary legacy inserts compatible; a changed body cannot leave stale JSON.
create function public.sync_article_rich_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.content_json is null or (tg_op = 'UPDATE' and new.body is distinct from old.body and new.content_json is not distinct from old.content_json)
    then new.content_json := public.smu_plain_text_document(new.body); end if;
  return new;
end;
$$;
create trigger sync_article_rich_text before insert or update on public.article_translations
for each row execute function public.sync_article_rich_text();

revoke all on function public.smu_plain_text_document(text), public.validate_smu_rich_text(jsonb, text, integer), public.sync_article_rich_text()
  from public, anon, authenticated, service_role;

create function public.clear_article_inline_media_usages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.media_usages where entity_type = 'article' and entity_id = old.id and field_name in ('content_ru', 'content_kk');
    return old;
  end if;
  if new.deleted_at is not null then
    delete from public.media_usages where entity_type = 'article' and entity_id = new.id and field_name in ('content_ru', 'content_kk');
  end if;
  return new;
end;
$$;
create trigger articles_clear_inline_media_usages after update of deleted_at or delete on public.articles
for each row execute function public.clear_article_inline_media_usages();
revoke all on function public.clear_article_inline_media_usages() from public, anon, authenticated, service_role;

create or replace function public.save_article(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session(); v_id uuid;
  v_old public.articles%rowtype; v_locale text; v_t jsonb; v_old_slug text;
  v_category uuid := nullif(p_input->>'categoryId', '')::uuid;
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
  if (v_category is not null and not exists (select 1 from public.article_categories where id = v_category and is_active))
    or (v_cover is not null and not exists (select 1 from public.media_assets where id = v_cover
      and status = 'ready' and deleted_at is null and storage_bucket = 'article-media' and mime_type like 'image/%'))
    or exists (select 1 from jsonb_array_elements_text(p_input->'tagIds') t
      where not exists (select 1 from public.article_tags where id = t.value::uuid and is_active))
    then raise exception 'invalid_reference'; end if;
  if jsonb_typeof(p_input->'tagIds') is distinct from 'array' or jsonb_array_length(p_input->'tagIds') > 30
    then raise exception 'invalid_input'; end if;
  update public.articles set category_id = v_category, cover_media_id = v_cover,
    content_type = (p_input->>'contentType')::public.article_content_type,
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
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', v_id, case when p_id is null then 'article.create' else 'article.update' end,
      case when p_id is null then null else to_jsonb(v_old) end,
      jsonb_build_object('status', 'draft', 'categoryId', v_category, 'coverMediaId', v_cover,
        'tagIds', p_input->'tagIds', 'translations', jsonb_build_object(
          'ru', jsonb_build_object('title', p_input->'ru'->>'title', 'slug', p_input->'ru'->>'slug'),
          'kk', jsonb_build_object('title', p_input->'kk'->>'title', 'slug', p_input->'kk'->>'slug'))));
  return v_id;
end;
$$;


