alter type public.article_status add value if not exists 'scheduled' after 'approved';

alter table public.articles
  add column scheduled_at timestamptz,
  add column scheduled_by uuid references public.profiles(id) on delete set null;
create index articles_due_schedule_idx on public.articles(scheduled_at, id)
  where scheduled_at is not null and deleted_at is null;
alter table public.article_revisions add column is_system boolean not null default false;

-- All content saves/restores already return to draft. Clear their schedule in
-- the same transaction, including deletion and every workflow exit.
create function public.clear_article_schedule() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status::text <> 'scheduled' or new.deleted_at is not null then
    new.scheduled_at := null;
    new.scheduled_by := null;
  end if;
  return new;
end;
$$;
create trigger articles_clear_schedule before update on public.articles
  for each row execute function public.clear_article_schedule();
revoke all on function public.clear_article_schedule() from public, anon, authenticated, service_role;
alter table public.articles add constraint articles_schedule_state_check check (
  (status::text = 'scheduled' and deleted_at is null) = (scheduled_at is not null)
);

create function public.article_version_publishable(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.articles a where a.id = p_id and a.deleted_at is null
      and a.approved_version = a.content_version
      and (select count(*) from public.article_translations t
        where t.article_id = a.id and t.locale in ('ru', 'kk')) = 2
      and (not a.requires_scientific_review or exists (
        select 1 from public.article_reviews r where r.article_id = a.id
          and r.content_version = a.content_version and r.decision = 'approved'
          and r.reviewer_id = a.scientific_reviewer_id
      ))
  );
$$;
revoke all on function public.article_version_publishable(uuid) from public, anon, authenticated, service_role;

-- Null p_scheduled_at cancels back to approved without losing the review.
-- The timestamp is an optimistic token: content_version alone does not detect
-- a second publisher changing/cancelling the schedule of the same content.
create function public.schedule_article(
  p_id uuid,
  p_expected_version integer,
  p_scheduled_at timestamptz,
  p_expected_scheduled_at timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session();
  v_old public.articles%rowtype;
begin
  if not public.has_permission('articles.publish') then raise exception 'forbidden'; end if;
  select * into v_old from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_expected_version is distinct from v_old.content_version
    or p_expected_scheduled_at is distinct from v_old.scheduled_at
    then raise exception 'stale_version'; end if;
  if v_old.status::text not in ('approved', 'scheduled')
    or (p_scheduled_at is null and v_old.status::text <> 'scheduled')
    then raise exception 'invalid_transition'; end if;
  if p_scheduled_at is not null and (not isfinite(p_scheduled_at) or p_scheduled_at <= now())
    then raise exception 'invalid_input'; end if;
  if not public.article_version_publishable(p_id) then raise exception 'invalid_transition'; end if;
  if p_scheduled_at is not distinct from v_old.scheduled_at then return; end if;

  update public.articles set
    status = (case when p_scheduled_at is null then 'approved' else 'scheduled' end)::public.article_status,
    scheduled_at = p_scheduled_at,
    scheduled_by = case when p_scheduled_at is null then null else v_actor end,
    updated_by = v_actor
    where id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', p_id,
      case when p_scheduled_at is null then 'article.schedule.cancel' else 'article.schedule.set' end,
      jsonb_build_object('status', v_old.status, 'scheduledAt', v_old.scheduled_at, 'version', v_old.content_version),
      jsonb_build_object('status', case when p_scheduled_at is null then 'approved' else 'scheduled' end,
        'scheduledAt', p_scheduled_at, 'version', v_old.content_version));
end;
$$;
revoke all on function public.schedule_article(uuid, integer, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.schedule_article(uuid, integer, timestamptz, timestamptz) to authenticated;

-- Keep the prior RPC implementation private and delegate its existing workflow.
alter function public.change_article_state(uuid, public.article_status, boolean, integer)
  rename to change_article_state_before_scheduling;
revoke all on function public.change_article_state_before_scheduling(uuid, public.article_status, boolean, integer)
  from public, anon, authenticated, service_role;
create function public.change_article_state(
  p_id uuid, p_status public.article_status, p_delete boolean default false,
  p_expected_version integer default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session();
  v_old public.articles%rowtype;
begin
  select * into v_old from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if not p_delete and v_old.status::text = 'scheduled' then
    if not public.has_permission('articles.publish') then raise exception 'forbidden'; end if;
    if p_expected_version is distinct from v_old.content_version then raise exception 'stale_version'; end if;
    if p_status::text not in ('draft', 'published') or p_status is null
      then raise exception 'invalid_transition'; end if;
    if p_status::text = 'published' and not public.article_version_publishable(p_id)
      then raise exception 'invalid_transition'; end if;
    update public.articles set status = p_status, updated_by = v_actor,
      approved_version = case when p_status::text = 'draft' then null else approved_version end,
      published_at = case when p_status::text = 'published' then now() else published_at end,
      first_published_at = case when p_status::text = 'published' then coalesce(first_published_at, now()) else first_published_at end
      where id = p_id;
    insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
      values (v_actor, 'article', p_id, 'article.status.change',
        jsonb_build_object('status', v_old.status, 'scheduledAt', v_old.scheduled_at, 'version', v_old.content_version),
        jsonb_build_object('status', p_status, 'version', v_old.content_version));
  else
    perform public.change_article_state_before_scheduling(p_id, p_status, p_delete, p_expected_version);
  end if;
end;
$$;
revoke all on function public.change_article_state(uuid, public.article_status, boolean, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.change_article_state(uuid, public.article_status, boolean, integer) to authenticated;

-- Preserve the complete snapshot (credits, relations, rich text and media).
-- This internal helper has no caller grants. Public revision RPCs continue to
-- require a user session; only a publish snapshot can use the system actor.
create or replace function public.capture_article_revision(p_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_article public.articles%rowtype;
  v_snapshot jsonb; v_translations jsonb; v_id uuid;
begin
  select * into v_article from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if v_actor is not null then
    perform public.require_smu_session();
  elsif p_reason is distinct from 'publish' or v_article.status::text <> 'published' then
    raise exception 'forbidden';
  end if;
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
  insert into public.article_revisions(article_id, revision_number, content_version, reason, title_ru, title_kk, snapshot, created_by, is_system)
    select p_id, coalesce(max(revision_number), 0) + 1, v_article.content_version, p_reason,
      v_snapshot->'ru'->>'title', v_snapshot->'kk'->>'title', v_snapshot, v_actor, v_actor is null
    from public.article_revisions where article_id = p_id returning id into v_id;
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

-- Called only by the authenticated cron endpoint with a service-role client.
-- Row locks exclude both overlapping jobs and simultaneous editorial writes.
-- Each transition, publish revision and audit share one bounded transaction.
create function public.publish_scheduled_articles(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_article public.articles%rowtype;
  v_published integer := 0;
  v_rejected integer := 0;
  v_reason text;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_input'; end if;
  for v_article in
    select * from public.articles
    where status::text = 'scheduled' and scheduled_at <= now() and deleted_at is null
    order by scheduled_at, id limit p_limit for update skip locked
  loop
    v_reason := null;
    if not public.article_version_publishable(v_article.id) then
      v_reason := 'invalid_approval';
    elsif (select count(distinct p.code) from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = v_article.scheduled_by and p.code in ('admin.access', 'articles.publish')) <> 2 then
      v_reason := 'publisher_permissions';
    end if;
    if v_reason is not null then
      update public.articles set status = 'draft', approved_version = null, updated_by = null
        where id = v_article.id;
      v_rejected := v_rejected + 1;
    else
      update public.articles set status = 'published', published_at = now(),
        first_published_at = coalesce(first_published_at, now()), updated_by = null
        where id = v_article.id;
      v_published := v_published + 1;
    end if;
    insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
      values (null, 'article', v_article.id,
        case when v_reason is null then 'article.schedule.publish' else 'article.schedule.reject' end,
        jsonb_build_object('status', 'scheduled', 'scheduledAt', v_article.scheduled_at,
          'scheduledBy', v_article.scheduled_by, 'version', v_article.content_version),
        jsonb_build_object('status', case when v_reason is null then 'published' else 'draft' end,
          'reason', v_reason, 'version', v_article.content_version));
  end loop;
  return jsonb_build_object('published', v_published, 'rejected', v_rejected);
end;
$$;
revoke all on function public.publish_scheduled_articles(integer) from public, anon, authenticated, service_role;
grant execute on function public.publish_scheduled_articles(integer) to service_role;
