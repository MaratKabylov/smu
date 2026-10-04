-- A revision is one atomic RU/KK snapshot. Workflow/ownership fields are never
-- restored: restoration uses save_article and always requires fresh approval.
create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  content_version integer not null check (content_version > 0),
  reason text not null check (reason in ('manual', 'review', 'publish', 'before_restore')),
  title_ru text not null,
  title_kk text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (article_id, revision_number)
);
alter table public.article_revisions enable row level security;
revoke all on public.article_revisions from public, anon, authenticated, service_role;
grant select on public.article_revisions to authenticated;
create policy article_revisions_read_editorial on public.article_revisions
for select to authenticated using (
  public.has_permission('admin.access') and exists (
    select 1 from public.articles a where a.id = article_id and a.deleted_at is null and (
      public.has_permission('articles.edit_any') or public.has_permission('articles.publish')
      or (a.author_id = auth.uid() and public.has_permission('articles.edit_own'))
      or (a.scientific_reviewer_id = auth.uid() and public.has_permission('articles.review'))
    )
  )
);

-- Internal helper. The article lock also serializes per-article numbering.
create function public.capture_article_revision(p_id uuid, p_reason text) returns uuid
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

create function public.snapshot_article_workflow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('in_review', 'published') and new.deleted_at is null then
    perform public.capture_article_revision(new.id, case when new.status = 'in_review' then 'review' else 'publish' end);
  end if;
  return new;
end;
$$;
create trigger article_workflow_revision after update of status on public.articles
for each row execute function public.snapshot_article_workflow();
revoke all on function public.snapshot_article_workflow() from public, anon, authenticated, service_role;

create function public.clear_article_revision_media() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.media_usages where entity_type = 'article_revision' and entity_id = old.id;
  return old;
end;
$$;
create trigger article_revision_clear_media after delete on public.article_revisions
for each row execute function public.clear_article_revision_media();
revoke all on function public.clear_article_revision_media() from public, anon, authenticated, service_role;

create function public.create_article_revision(p_id uuid, p_expected_version integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_article public.articles%rowtype;
begin
  select * into v_article from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if not (public.has_permission('articles.edit_any') or
    (v_article.author_id = v_actor and v_article.status = 'draft' and public.has_permission('articles.edit_own')))
    or (v_article.status = 'archived' and not public.has_permission('articles.publish')) then raise exception 'forbidden'; end if;
  if p_expected_version is distinct from v_article.content_version then raise exception 'stale_version'; end if;
  return public.capture_article_revision(p_id, 'manual');
end;
$$;

create function public.restore_article_revision(p_id uuid, p_revision uuid, p_expected_version integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session(); v_article public.articles%rowtype;
  v_revision public.article_revisions%rowtype; v_checkpoint uuid;
begin
  select * into v_article from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if not (public.has_permission('articles.edit_any') or
    (v_article.author_id = v_actor and v_article.status = 'draft' and public.has_permission('articles.edit_own')))
    or (v_article.status = 'archived' and not public.has_permission('articles.publish')) then raise exception 'forbidden'; end if;
  if p_expected_version is distinct from v_article.content_version then raise exception 'stale_version'; end if;
  select * into v_revision from public.article_revisions where id = p_revision and article_id = p_id;
  if not found then raise exception 'not_found'; end if;
  -- Preserve the current content before replacing it. Any failure (references,
  -- slug, media, audit) rolls back the checkpoint and the entire restoration.
  v_checkpoint := public.capture_article_revision(p_id, 'before_restore');
  perform public.save_article(p_id, v_revision.snapshot || jsonb_build_object('expectedVersion', p_expected_version));
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', p_id, 'article.revision.restore',
      jsonb_build_object('version', v_article.content_version, 'checkpointId', v_checkpoint),
      jsonb_build_object('revisionId', p_revision, 'version', v_article.content_version + 1, 'status', 'draft'));
  return v_article.content_version + 1;
end;
$$;
revoke all on function public.create_article_revision(uuid, integer), public.restore_article_revision(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.create_article_revision(uuid, integer), public.restore_article_revision(uuid, uuid, integer)
  to authenticated;
