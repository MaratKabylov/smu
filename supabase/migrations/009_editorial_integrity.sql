-- User mutations run under the caller's JWT. Definer functions expose a narrow,
-- transactional interface and repeat authorization with auth.uid(), never p_actor.
alter table public.articles
  add column scientific_reviewer_id uuid references public.profiles(id) on delete set null,
  add column content_version integer not null default 1 check (content_version > 0),
  add column approved_version integer,
  add column first_published_at timestamptz,
  add column updated_by uuid references public.profiles(id) on delete set null;
update public.articles set first_published_at = published_at,
  approved_version = case when status in ('approved', 'published') then content_version end;
alter table public.scientist_profiles add column first_verified_at timestamptz;
update public.scientist_profiles set first_verified_at = verified_at;

create table public.slug_redirects (
  entity_type text not null check (entity_type in ('article', 'scientist')),
  entity_id uuid not null,
  locale text not null check (locale in ('ru', 'kk')),
  old_slug text not null,
  created_at timestamptz not null default now(),
  primary key (entity_type, locale, old_slug)
);
alter table public.slug_redirects enable row level security;
create policy slug_redirects_public on public.slug_redirects for select to anon, authenticated
using (
  (entity_type = 'article' and exists (select 1 from public.articles a where a.id = entity_id
    and a.status = 'published' and a.published_at <= now() and a.deleted_at is null))
  or (entity_type = 'scientist' and exists (select 1 from public.scientist_profiles s where s.id = entity_id
    and s.status = 'verified' and s.deleted_at is null))
);
revoke all on public.slug_redirects from public, anon, authenticated;
grant select on public.slug_redirects to anon, authenticated;

drop policy articles_read_editorial on public.articles;
create policy articles_read_editorial on public.articles for select to authenticated
using (deleted_at is null and (
  (author_id = auth.uid() and public.has_permission('articles.edit_own'))
  or public.has_permission('articles.edit_any') or public.has_permission('articles.publish')
  or (scientific_reviewer_id = auth.uid() and public.has_permission('articles.review'))
));
drop policy scientist_profiles_read_managers on public.scientist_profiles;
create policy scientist_profiles_read_managers on public.scientist_profiles for select to authenticated
using (deleted_at is null and (public.has_permission('scientists.edit') or public.has_permission('scientists.verify')));

-- Explicit grants: ordinary callers cannot skip workflow/audit by writing tables.
revoke insert, update, delete, truncate on public.articles, public.article_translations,
  public.article_tag_links, public.article_categories, public.article_tags,
  public.scientist_profiles, public.scientist_profile_translations, public.scientist_field_links,
  public.scientific_organizations, public.scientific_fields from anon, authenticated;
grant select on public.articles, public.article_translations, public.article_tag_links,
  public.article_categories, public.article_tags, public.scientist_profiles,
  public.scientist_profile_translations, public.scientist_field_links,
  public.scientific_organizations, public.scientific_fields to anon, authenticated;
-- Do not rely on Supabase's historical automatic table privileges.
grant select on public.profiles, public.roles, public.permissions, public.user_roles,
  public.role_permissions, public.audit_logs to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert, delete on public.user_roles, public.role_permissions to authenticated;
grant select on public.media_assets, public.media_usages to anon, authenticated;

create function public.require_smu_session() returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_permission('admin.access') then raise exception 'forbidden'; end if;
  return v_actor;
end;
$$;
revoke all on function public.require_smu_session() from public, anon, authenticated, service_role;

-- Serializes reservations within a locale; history resolves directly to the
-- entity's current slug, so repeated renames never create redirect chains.
create function public.preserve_smu_slug(p_type text, p_id uuid, p_locale text,
  p_old text, p_new text, p_was_public boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_new is null or length(p_new) not between 2 and 160 or p_new !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    then raise exception 'invalid_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('smu_slug:' || p_type || ':' || p_locale, 0));
  if exists (select 1 from public.slug_redirects where entity_type = p_type and locale = p_locale
    and old_slug = p_new and entity_id <> p_id) then raise exception 'slug_reserved'; end if;
  if p_was_public and p_old is not null and p_old <> p_new then
    insert into public.slug_redirects(entity_type, entity_id, locale, old_slug)
      values (p_type, p_id, p_locale, p_old) on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.preserve_smu_slug(text, uuid, text, text, text, boolean)
  from public, anon, authenticated, service_role;

create function public.save_article(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session(); v_id uuid;
  v_old public.articles%rowtype; v_locale text; v_t jsonb; v_old_slug text;
  v_category uuid := nullif(p_input->>'categoryId', '')::uuid;
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
    if v_t is null or length(btrim(v_t->>'title')) not between 3 and 240
      or length(btrim(v_t->>'excerpt')) not between 10 and 1000
      or length(btrim(v_t->>'body')) not between 20 and 200000
      or v_t->>'title' is null or v_t->>'excerpt' is null or v_t->>'body' is null
      or length(coalesce(v_t->>'seoTitle', '')) > 70 or length(coalesce(v_t->>'seoDescription', '')) > 170
      then raise exception 'invalid_input'; end if;
    select slug into v_old_slug from public.article_translations where article_id = v_id and locale = v_locale;
    perform public.preserve_smu_slug('article', v_id, v_locale, v_old_slug, v_t->>'slug', v_old.first_published_at is not null);
    insert into public.article_translations(article_id, locale, title, slug, excerpt, body, seo_title, seo_description)
      values (v_id, v_locale, btrim(v_t->>'title'), v_t->>'slug', btrim(v_t->>'excerpt'), btrim(v_t->>'body'),
        nullif(v_t->>'seoTitle', ''), nullif(v_t->>'seoDescription', ''))
      on conflict (article_id, locale) do update set title = excluded.title, slug = excluded.slug,
        excerpt = excluded.excerpt, body = excluded.body, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
  end loop;
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

create function public.change_article_state(p_id uuid, p_status public.article_status, p_delete boolean default false,
  p_expected_version integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_old public.articles%rowtype;
  v_edit boolean; v_review boolean; v_publish boolean;
begin
  select * into v_old from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  v_edit := public.has_permission('articles.edit_any')
    or (v_old.author_id = v_actor and public.has_permission('articles.edit_own'));
  v_review := public.has_permission('articles.review') and
    (public.has_permission('articles.edit_any') or public.has_permission('articles.publish') or v_old.scientific_reviewer_id = v_actor);
  v_publish := public.has_permission('articles.publish');
  if p_delete then
    if not public.has_permission('articles.delete') then raise exception 'forbidden'; end if;
    update public.articles set deleted_at = now(), updated_by = v_actor where id = p_id;
  else
    -- Repeated requests are rejected before touching timestamps or audit.
    if p_status is null or p_status = v_old.status then raise exception 'invalid_transition'; end if;
    if (p_expected_version is not null or p_status in ('approved', 'published'))
      and p_expected_version is distinct from v_old.content_version then raise exception 'stale_version'; end if;
    if not coalesce(
      (v_old.status = 'draft' and p_status = 'in_review' and v_edit)
      or (v_old.status = 'in_review' and p_status = 'draft' and (v_review or v_edit))
      or (v_old.status = 'in_review' and p_status = 'approved' and v_review)
      or (v_old.status = 'approved' and p_status = 'draft' and (v_review or v_publish))
      or (v_old.status = 'approved' and p_status = 'published' and v_publish)
      or (v_old.status = 'published' and p_status in ('draft', 'archived') and v_publish)
      or (v_old.status = 'archived' and p_status = 'draft' and v_publish), false)
      then raise exception 'forbidden'; end if;
    if p_status = 'published' and (v_old.approved_version is distinct from v_old.content_version
      or (select count(*) from public.article_translations where article_id = p_id) <> 2)
      then raise exception 'invalid_transition'; end if;
    update public.articles set status = p_status, updated_by = v_actor,
      approved_version = case when p_status = 'approved' then content_version
        when p_status in ('draft', 'in_review') then null else approved_version end,
      published_at = case when p_status = 'published' then now() else published_at end,
      first_published_at = case when p_status = 'published' then coalesce(first_published_at, now()) else first_published_at end
      where id = p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', p_id, case when p_delete then 'article.soft_delete' else 'article.status.change' end,
      jsonb_build_object('status', v_old.status, 'version', v_old.content_version),
      jsonb_build_object('status', p_status, 'deleted', p_delete, 'version', v_old.content_version));
end;
$$;

create function public.list_article_reviewers() returns table(id uuid, display_name text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_smu_session();
  if not (public.has_permission('articles.edit_any') or public.has_permission('articles.publish')) then raise exception 'forbidden'; end if;
  return query select p.id, p.display_name from public.profiles p where exists (
    select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions pe on pe.id = rp.permission_id where ur.user_id = p.id and pe.code = 'articles.review'
  ) and exists (
    select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions pe on pe.id = rp.permission_id where ur.user_id = p.id and pe.code = 'admin.access'
  ) order by p.display_name;
end;
$$;

create function public.assign_article_reviewer(p_id uuid, p_reviewer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_old public.articles%rowtype;
begin
  if not (public.has_permission('articles.edit_any') or public.has_permission('articles.publish')) then raise exception 'forbidden'; end if;
  select * into v_old from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if v_old.scientific_reviewer_id is not distinct from p_reviewer then return; end if;
  if v_old.status not in ('draft', 'in_review') then raise exception 'invalid_transition'; end if;
  if p_reviewer is not null and not exists (select 1 from public.list_article_reviewers() r where r.id = p_reviewer)
    then raise exception 'invalid_reference'; end if;
  update public.articles set scientific_reviewer_id = p_reviewer, updated_by = v_actor,
    approved_version = null where id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', p_id, 'article.reviewer.assign',
      jsonb_build_object('reviewerId', v_old.scientific_reviewer_id), jsonb_build_object('reviewerId', p_reviewer));
end;
$$;

create function public.save_scientist(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session(); v_id uuid; v_old public.scientist_profiles%rowtype;
  v_locale text; v_t jsonb; v_old_slug text;
  v_org uuid := nullif(p_input->>'organizationId', '')::uuid;
  v_avatar uuid := nullif(p_input->>'avatarMediaId', '')::uuid;
begin
  if not public.has_permission('scientists.edit') then raise exception 'forbidden'; end if;
  if p_id is null then
    insert into public.scientist_profiles(created_by) values (v_actor) returning id into v_id;
  else
    select * into v_old from public.scientist_profiles where id = p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    v_id := p_id;
  end if;
  if (v_org is not null and not exists (select 1 from public.scientific_organizations where id = v_org and is_active))
    or (v_avatar is not null and not exists (select 1 from public.media_assets where id = v_avatar
      and status = 'ready' and deleted_at is null and storage_bucket = 'avatars' and mime_type like 'image/%'))
    or exists (select 1 from jsonb_array_elements_text(p_input->'fieldIds') f
      where not exists (select 1 from public.scientific_fields where id = f.value::uuid and is_active))
    then raise exception 'invalid_reference'; end if;
  if jsonb_typeof(p_input->'fieldIds') is distinct from 'array' or jsonb_array_length(p_input->'fieldIds') > 20
    or length(coalesce(p_input->>'publicEmail', '')) > 254
    or (nullif(p_input->>'publicEmail', '') is not null and p_input->>'publicEmail' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (nullif(p_input->>'scholarUrl', '') is not null and p_input->>'scholarUrl' !~* '^https?://')
    then raise exception 'invalid_input'; end if;
  update public.scientist_profiles set organization_id = v_org, avatar_media_id = v_avatar,
    public_email = nullif(p_input->>'publicEmail', ''), orcid = nullif(p_input->>'orcid', ''),
    scholar_url = nullif(p_input->>'scholarUrl', ''), status = 'draft', verified_at = null, verified_by = null where id = v_id;
  foreach v_locale in array array['ru', 'kk'] loop
    v_t := p_input->v_locale;
    if v_t is null or v_t->>'fullName' is null or v_t->>'position' is null or v_t->>'shortBio' is null or v_t->>'biography' is null
      or length(btrim(v_t->>'fullName')) not between 3 and 180 or length(btrim(v_t->>'position')) not between 2 and 180
      or length(btrim(v_t->>'shortBio')) not between 20 and 600 or length(btrim(v_t->>'biography')) not between 40 and 20000
      or length(coalesce(v_t->>'academicDegree', '')) > 180 then raise exception 'invalid_input'; end if;
    select slug into v_old_slug from public.scientist_profile_translations where scientist_profile_id = v_id and locale = v_locale;
    perform public.preserve_smu_slug('scientist', v_id, v_locale, v_old_slug, v_t->>'slug', v_old.first_verified_at is not null);
    insert into public.scientist_profile_translations(scientist_profile_id, locale, full_name, slug, position, academic_degree, short_bio, biography)
      values (v_id, v_locale, btrim(v_t->>'fullName'), v_t->>'slug', btrim(v_t->>'position'),
        nullif(v_t->>'academicDegree', ''), btrim(v_t->>'shortBio'), btrim(v_t->>'biography'))
      on conflict (scientist_profile_id, locale) do update set full_name = excluded.full_name, slug = excluded.slug,
        position = excluded.position, academic_degree = excluded.academic_degree, short_bio = excluded.short_bio, biography = excluded.biography;
  end loop;
  delete from public.scientist_field_links where scientist_profile_id = v_id;
  insert into public.scientist_field_links(scientist_profile_id, scientific_field_id)
    select v_id, value::uuid from jsonb_array_elements_text(p_input->'fieldIds');
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'scientist_profile', v_id, case when p_id is null then 'scientist.create' else 'scientist.update' end,
      case when p_id is null then null else jsonb_build_object('status', v_old.status) end,
      jsonb_build_object('status', 'draft', 'organizationId', v_org, 'avatarMediaId', v_avatar, 'fieldIds', p_input->'fieldIds'));
  return v_id;
end;
$$;

create function public.change_scientist_state(p_id uuid, p_status public.scientist_profile_status, p_delete boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_old public.scientist_profiles%rowtype;
begin
  if not public.has_permission(case when p_delete then 'scientists.edit' else 'scientists.verify' end)
    then raise exception 'forbidden'; end if;
  select * into v_old from public.scientist_profiles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if p_delete then
    update public.scientist_profiles set deleted_at = now() where id = p_id;
  else
    if p_status is null or p_status = v_old.status then raise exception 'invalid_transition'; end if;
    if p_status = 'verified' then
      if (select count(*) from public.scientist_profile_translations where scientist_profile_id = p_id) <> 2
        then raise exception 'invalid_transition'; end if;
      if (v_old.organization_id is not null and not exists (select 1 from public.scientific_organizations where id = v_old.organization_id and is_active))
        or (v_old.avatar_media_id is not null and not exists (select 1 from public.media_assets where id = v_old.avatar_media_id
          and status = 'ready' and deleted_at is null and storage_bucket = 'avatars'))
        or exists (select 1 from public.scientist_field_links f join public.scientific_fields sf on sf.id = f.scientific_field_id
          where f.scientist_profile_id = p_id and not sf.is_active) then raise exception 'invalid_reference'; end if;
    end if;
    update public.scientist_profiles set status = p_status,
      verified_at = case when p_status = 'verified' then now() end,
      verified_by = case when p_status = 'verified' then v_actor end,
      first_verified_at = case when p_status = 'verified' then coalesce(first_verified_at, now()) else first_verified_at end where id = p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'scientist_profile', p_id, case when p_delete then 'scientist.soft_delete' else 'scientist.status.change' end,
      jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status, 'deleted', p_delete));
end;
$$;

create function public.create_article_taxonomy(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_id uuid;
begin
  if not public.has_permission('articles.edit_any') then raise exception 'forbidden'; end if;
  if p_input->>'slug' is null or p_input->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(p_input->>'slug') not between 2 and 160
    or p_input->>'nameRu' is null or p_input->>'nameKk' is null
    or length(btrim(p_input->>'nameRu')) not between 2 and 120 or length(btrim(p_input->>'nameKk')) not between 2 and 120
    then raise exception 'invalid_input'; end if;
  if p_input->>'kind' = 'category' then
    insert into public.article_categories(slug, name_ru, name_kk) values (p_input->>'slug', p_input->>'nameRu', p_input->>'nameKk') returning id into v_id;
  elsif p_input->>'kind' = 'tag' then
    insert into public.article_tags(slug, name_ru, name_kk) values (p_input->>'slug', p_input->>'nameRu', p_input->>'nameKk') returning id into v_id;
  else raise exception 'invalid_input'; end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, new_data)
    values (v_actor, 'article_' || (p_input->>'kind'), v_id, 'article.' || (p_input->>'kind') || '.create', p_input);
  return v_id;
end;
$$;

create function public.create_scientist_taxonomy(p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_id uuid;
begin
  if not public.has_permission('scientists.edit') then raise exception 'forbidden'; end if;
  if p_input->>'slug' is null or p_input->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(p_input->>'slug') not between 2 and 160
    or p_input->>'nameRu' is null or p_input->>'nameKk' is null
    or length(btrim(p_input->>'nameRu')) not between 2 and 200 or length(btrim(p_input->>'nameKk')) not between 2 and 200
    or (nullif(p_input->>'websiteUrl', '') is not null and p_input->>'websiteUrl' !~* '^https?://')
    then raise exception 'invalid_input'; end if;
  if p_input->>'kind' = 'field' then
    insert into public.scientific_fields(slug, name_ru, name_kk) values (p_input->>'slug', p_input->>'nameRu', p_input->>'nameKk') returning id into v_id;
  elsif p_input->>'kind' = 'organization' then
    insert into public.scientific_organizations(slug, name_ru, name_kk, city_ru, city_kk, website_url)
      values (p_input->>'slug', p_input->>'nameRu', p_input->>'nameKk', nullif(p_input->>'cityRu', ''),
        nullif(p_input->>'cityKk', ''), nullif(p_input->>'websiteUrl', '')) returning id into v_id;
  else raise exception 'invalid_input'; end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, new_data)
    values (v_actor, case when p_input->>'kind' = 'field' then 'scientific_field' else 'scientific_organization' end,
      v_id, 'scientist.' || (p_input->>'kind') || '.create', p_input);
  return v_id;
end;
$$;

revoke all on function public.save_article(uuid, jsonb), public.change_article_state(uuid, public.article_status, boolean, integer),
  public.list_article_reviewers(), public.assign_article_reviewer(uuid, uuid),
  public.save_scientist(uuid, jsonb), public.change_scientist_state(uuid, public.scientist_profile_status, boolean),
  public.create_article_taxonomy(jsonb), public.create_scientist_taxonomy(jsonb) from public, anon, service_role;
grant execute on function public.save_article(uuid, jsonb), public.change_article_state(uuid, public.article_status, boolean, integer),
  public.list_article_reviewers(), public.assign_article_reviewer(uuid, uuid),
  public.save_scientist(uuid, jsonb), public.change_scientist_state(uuid, public.scientist_profile_status, boolean),
  public.create_article_taxonomy(jsonb), public.create_scientist_taxonomy(jsonb) to authenticated;
