-- A narrow trash RPC avoids widening parent RLS and accidentally exposing
-- deleted translations through existing public/related-content queries.
create function public.list_deleted_editorial_records(p_kind text default 'all', p_query text default '', p_page integer default 1)
returns table(id uuid, entity_type text, title_ru text, title_kk text, status text, deleted_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_smu_session();
  if not (public.has_permission('articles.delete') or public.has_permission('scientists.edit')) then raise exception 'forbidden'; end if;
  if p_kind is null or p_kind not in ('all', 'article', 'scientist') or p_query is null or length(p_query) > 120
    or p_page is null or p_page not between 1 and 10000 then raise exception 'invalid_input'; end if;
  if (p_kind = 'article' and not public.has_permission('articles.delete'))
    or (p_kind = 'scientist' and not public.has_permission('scientists.edit')) then raise exception 'forbidden'; end if;
  return query select d.* from (
    select a.id, 'article'::text entity_type, ru.title title_ru, kk.title title_kk, a.status::text status, a.deleted_at
    from public.articles a
    left join public.article_translations ru on ru.article_id = a.id and ru.locale = 'ru'
    left join public.article_translations kk on kk.article_id = a.id and kk.locale = 'kk'
    where a.deleted_at is not null and p_kind in ('all', 'article') and public.has_permission('articles.delete')
    union all
    select s.id, 'scientist', ru.full_name, kk.full_name, s.status::text, s.deleted_at
    from public.scientist_profiles s
    left join public.scientist_profile_translations ru on ru.scientist_profile_id = s.id and ru.locale = 'ru'
    left join public.scientist_profile_translations kk on kk.scientist_profile_id = s.id and kk.locale = 'kk'
    where s.deleted_at is not null and p_kind in ('all', 'scientist') and public.has_permission('scientists.edit')
  ) d where p_query = '' or d.title_ru ilike '%' || p_query || '%' or d.title_kk ilike '%' || p_query || '%'
  order by d.deleted_at desc, d.entity_type, d.id limit 51 offset (p_page - 1) * 50;
end;
$$;

-- Targets are locked in the same order as save_article. Publication visibility
-- also depends on its scientist, so that parent must remain locked too.
create function public.assert_restorable_article_links(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_link record; v_table text;
begin
  for v_link in select * from public.smu_article_links where article_id = p_id order by kind, entity_id loop
    v_table := case v_link.kind when 'scientist' then 'scientist_profiles' when 'project' then 'science_works'
      when 'research' then 'science_works' when 'event' then 'events' else 'publications' end;
    execute format('select 1 from public.%I where id = $1 for share', v_table) using v_link.entity_id;
    if v_link.kind = 'publication' then
      perform 1 from public.scientist_profiles s join public.publications p on p.scientist_id = s.id
        where p.id = v_link.entity_id for share of s;
    end if;
    if (select count(*) from public.smu_public_relation_targets where kind = v_link.kind and entity_id = v_link.entity_id) <> 2
      then raise exception 'invalid_reference'; end if;
  end loop;
end;
$$;

create function public.restore_deleted_article(p_id uuid, p_expected_deleted_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_old public.articles%rowtype; v_t record; v_media record;
begin
  if not public.has_permission('articles.delete') then raise exception 'forbidden'; end if;
  if p_expected_deleted_at is null then raise exception 'invalid_input'; end if;
  select * into v_old from public.articles where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  -- The exact deletion timestamp identifies this deletion, including a second
  -- delete after a restore. Repeated/stale forms cannot restore a new deletion.
  if v_old.deleted_at is distinct from p_expected_deleted_at then raise exception 'stale_version'; end if;

  perform 1 from public.article_types where slug = v_old.content_type for share;
  perform 1 from public.article_categories where id = v_old.category_id or id in
    (select category_id from public.article_category_links where article_id = p_id) order by id for share;
  perform 1 from public.article_tags where id in
    (select tag_id from public.article_tag_links where article_id = p_id) order by id for share;
  perform 1 from public.authors where id in
    (select author_id from public.article_authors where article_id = p_id) order by id for share;
  if not exists(select 1 from public.article_types where slug = v_old.content_type and is_active)
    or (v_old.category_id is not null and not exists(select 1 from public.article_categories where id = v_old.category_id and is_active))
    or exists(select 1 from public.article_category_links l join public.article_categories c on c.id = l.category_id where l.article_id = p_id and not c.is_active)
    or exists(select 1 from public.article_tag_links l join public.article_tags t on t.id = l.tag_id where l.article_id = p_id and not t.is_active)
    or exists(select 1 from public.article_authors l join public.authors a on a.id = l.author_id where l.article_id = p_id and not a.is_active)
    then raise exception 'invalid_reference'; end if;

  -- Include inline images, whose usages were removed by soft delete. Never
  -- silently strip missing media or the scientific links from recovered text.
  for v_media in
    select v_old.cover_media_id id where v_old.cover_media_id is not null
    union select distinct (image.value->'attrs'->>'mediaId')::uuid
      from public.article_translations t
      cross join lateral jsonb_path_query(t.content_json, '$.** ? (@.type == "image")') image(value)
      where t.article_id = p_id
    order by id
  loop
    perform 1 from public.media_assets where id = v_media.id and status = 'ready' and deleted_at is null
      and storage_bucket = 'article-media' and mime_type like 'image/%' for share;
    if not found then raise exception 'invalid_reference'; end if;
  end loop;
  for v_t in select * from public.article_translations where article_id = p_id order by locale loop
    perform public.validate_smu_rich_text(v_t.content_json);
    perform public.preserve_smu_slug('article', p_id, v_t.locale, v_t.slug, v_t.slug, false);
  end loop;
  perform public.assert_restorable_article_links(p_id);
  update public.articles set deleted_at = null, status = 'draft', approved_version = null,
    published_at = null, scheduled_at = null, scheduled_by = null,
    content_version = content_version + 1, updated_by = v_actor where id = p_id;
  -- Existing trigger restores cover usage; inline usages need explicit recovery.
  insert into public.media_usages(media_asset_id, entity_type, entity_id, field_name)
    select distinct (image.value->'attrs'->>'mediaId')::uuid, 'article', p_id, 'content_' || t.locale
    from public.article_translations t
    cross join lateral jsonb_path_query(t.content_json, '$.** ? (@.type == "image")') image(value)
    where t.article_id = p_id on conflict do nothing;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values(v_actor, 'article', p_id, 'article.restore',
      jsonb_build_object('status', v_old.status, 'deletedAt', v_old.deleted_at, 'contentVersion', v_old.content_version),
      jsonb_build_object('status', 'draft', 'deletedAt', null, 'contentVersion', v_old.content_version + 1));
end;
$$;

create function public.restore_deleted_scientist(p_id uuid, p_expected_deleted_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_old public.scientist_profiles%rowtype; v_t record;
begin
  if not public.has_permission('scientists.edit') then raise exception 'forbidden'; end if;
  if p_expected_deleted_at is null then raise exception 'invalid_input'; end if;
  select * into v_old from public.scientist_profiles where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_old.deleted_at is distinct from p_expected_deleted_at then raise exception 'stale_version'; end if;
  perform 1 from public.scientific_organizations where id = v_old.organization_id for share;
  perform 1 from public.scientific_fields where id in
    (select scientific_field_id from public.scientist_field_links where scientist_profile_id = p_id) order by id for share;
  if (v_old.organization_id is not null and not exists(select 1 from public.scientific_organizations where id = v_old.organization_id and is_active))
    or exists(select 1 from public.scientist_field_links l join public.scientific_fields f on f.id = l.scientific_field_id where l.scientist_profile_id = p_id and not f.is_active)
    then raise exception 'invalid_reference'; end if;
  if v_old.avatar_media_id is not null then
    perform 1 from public.media_assets where id = v_old.avatar_media_id and status = 'ready' and deleted_at is null
      and storage_bucket = 'avatars' and mime_type like 'image/%' for share;
    if not found then raise exception 'invalid_reference'; end if;
  end if;
  for v_t in select * from public.scientist_profile_translations where scientist_profile_id = p_id order by locale loop
    perform public.preserve_smu_slug('scientist', p_id, v_t.locale, v_t.slug, v_t.slug, false);
  end loop;
  update public.scientist_profiles set deleted_at = null, status = 'draft', verified_at = null, verified_by = null where id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values(v_actor, 'scientist_profile', p_id, 'scientist.restore',
      jsonb_build_object('status', v_old.status, 'deletedAt', v_old.deleted_at), jsonb_build_object('status', 'draft', 'deletedAt', null));
end;
$$;

revoke all on function public.assert_restorable_article_links(uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_deleted_editorial_records(text, text, integer),
  public.restore_deleted_article(uuid, timestamptz), public.restore_deleted_scientist(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.list_deleted_editorial_records(text, text, integer),
  public.restore_deleted_article(uuid, timestamptz), public.restore_deleted_scientist(uuid, timestamptz) to authenticated;
