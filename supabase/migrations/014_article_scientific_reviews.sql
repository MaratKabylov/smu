-- Review decisions are immutable and belong to the exact content version that
-- was opened by the reviewer. A content save still returns the article to a
-- draft and increments content_version, so an older decision cannot approve it.
alter type public.article_status add value if not exists 'changes_requested' after 'in_review';

alter table public.articles
  add column requires_scientific_review boolean not null default false;

create table public.article_reviews (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  content_version integer not null check (content_version > 0),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'changes_requested')),
  comment text not null check (length(btrim(comment)) between 3 and 5000),
  created_at timestamptz not null default now(),
  unique (article_id, content_version)
);
create index article_reviews_article_created_idx
  on public.article_reviews(article_id, created_at desc);

alter table public.article_reviews enable row level security;
revoke all on public.article_reviews from public, anon, authenticated, service_role;
grant select on public.article_reviews to authenticated;
create policy article_reviews_read_editorial on public.article_reviews
for select to authenticated using (
  public.has_permission('admin.access') and (
    reviewer_id = auth.uid() or exists (
      select 1 from public.articles a where a.id = article_id and a.deleted_at is null and (
        public.has_permission('articles.edit_any') or public.has_permission('articles.publish')
        or (a.author_id = auth.uid() and public.has_permission('articles.edit_own'))
        or (a.scientific_reviewer_id = auth.uid() and public.has_permission('articles.review'))
      )
    )
  )
);

create function public.configure_article_review(
  p_id uuid,
  p_requires_scientific_review boolean,
  p_reviewer uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session();
  v_old public.articles%rowtype;
begin
  if not (public.has_permission('articles.edit_any') or public.has_permission('articles.publish'))
    then raise exception 'forbidden'; end if;
  select * into v_old from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  if v_old.status::text not in ('draft', 'in_review', 'changes_requested')
    then raise exception 'invalid_transition'; end if;
  if p_requires_scientific_review is null or (p_requires_scientific_review and p_reviewer is null)
    then raise exception 'invalid_input'; end if;
  if p_reviewer is not null and not exists (
    select 1 from public.list_article_reviewers() r where r.id = p_reviewer
  ) then raise exception 'invalid_reference'; end if;
  if v_old.requires_scientific_review is not distinct from p_requires_scientific_review
    and v_old.scientific_reviewer_id is not distinct from p_reviewer then return; end if;

  update public.articles set
    requires_scientific_review = p_requires_scientific_review,
    scientific_reviewer_id = p_reviewer,
    approved_version = null,
    updated_by = v_actor
  where id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', p_id, 'article.review.configure',
      jsonb_build_object('requiresScientificReview', v_old.requires_scientific_review, 'reviewerId', v_old.scientific_reviewer_id),
      jsonb_build_object('requiresScientificReview', p_requires_scientific_review, 'reviewerId', p_reviewer));
end;
$$;

-- Preserve the old RPC for already deployed clients, while enforcing the new
-- invariant that a required review cannot lose its reviewer.
create or replace function public.assign_article_reviewer(p_id uuid, p_reviewer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_required boolean;
begin
  select requires_scientific_review into v_required from public.articles
    where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  perform public.configure_article_review(p_id, v_required, p_reviewer);
end;
$$;

create function public.submit_article_review(
  p_id uuid,
  p_expected_version integer,
  p_decision text,
  p_comment text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session();
  v_article public.articles%rowtype;
  v_review uuid;
  v_can_review boolean;
begin
  select * into v_article from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  v_can_review := public.has_permission('articles.review') and (
    public.has_permission('articles.edit_any') or public.has_permission('articles.publish')
    or v_article.scientific_reviewer_id = v_actor
  );
  if not v_can_review or (v_article.requires_scientific_review
    and v_article.scientific_reviewer_id is distinct from v_actor)
    then raise exception 'forbidden'; end if;
  if v_article.status::text <> 'in_review' then raise exception 'invalid_transition'; end if;
  if p_expected_version is distinct from v_article.content_version then raise exception 'stale_version'; end if;
  if p_decision not in ('approved', 'changes_requested') or p_decision is null
    or length(btrim(coalesce(p_comment, ''))) not between 3 and 5000
    then raise exception 'invalid_input'; end if;

  insert into public.article_reviews(article_id, content_version, reviewer_id, decision, comment)
    values (p_id, v_article.content_version, v_actor, p_decision, btrim(p_comment))
    returning id into v_review;
  update public.articles set status = p_decision::public.article_status, updated_by = v_actor,
    approved_version = case when p_decision = 'approved' then content_version else null end
    where id = p_id;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', p_id, 'article.review.decide',
      jsonb_build_object('status', v_article.status, 'version', v_article.content_version),
      jsonb_build_object('status', p_decision, 'version', v_article.content_version,
        'reviewId', v_review, 'comment', btrim(p_comment)));
  return v_review;
end;
$$;

create function public.list_article_reviews(p_id uuid)
returns table(
  id uuid,
  article_id uuid,
  content_version integer,
  reviewer_id uuid,
  reviewer_name text,
  decision text,
  comment text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_article public.articles%rowtype;
begin
  select * into v_article from public.articles where articles.id = p_id and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  if not (public.has_permission('articles.edit_any') or public.has_permission('articles.publish')
    or (v_article.author_id = v_actor and public.has_permission('articles.edit_own'))
    or (v_article.scientific_reviewer_id = v_actor and public.has_permission('articles.review'))
    or exists(select 1 from public.article_reviews ar where ar.article_id = p_id and ar.reviewer_id = v_actor))
    then raise exception 'forbidden'; end if;
  return query select ar.id, ar.article_id, ar.content_version, ar.reviewer_id,
    coalesce(p.display_name, 'Рецензент'), ar.decision, ar.comment, ar.created_at
    from public.article_reviews ar join public.profiles p on p.id = ar.reviewer_id
    where ar.article_id = p_id order by ar.created_at desc, ar.id desc;
end;
$$;

-- Approval and requested changes must always have an immutable decision row.
-- Other workflow changes keep the established transition and audit semantics.
create or replace function public.change_article_state(
  p_id uuid,
  p_status public.article_status,
  p_delete boolean default false,
  p_expected_version integer default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_smu_session();
  v_old public.articles%rowtype;
  v_edit boolean; v_review boolean; v_publish boolean;
  v_old_status text; v_new_status text;
begin
  select * into v_old from public.articles where id = p_id and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;
  v_old_status := v_old.status::text;
  v_new_status := p_status::text;
  v_edit := public.has_permission('articles.edit_any')
    or (v_old.author_id = v_actor and public.has_permission('articles.edit_own'));
  v_review := public.has_permission('articles.review') and
    (public.has_permission('articles.edit_any') or public.has_permission('articles.publish')
      or v_old.scientific_reviewer_id = v_actor);
  v_publish := public.has_permission('articles.publish');
  if p_delete then
    if not public.has_permission('articles.delete') then raise exception 'forbidden'; end if;
    update public.articles set deleted_at = now(), updated_by = v_actor where id = p_id;
  else
    if p_status is null or v_new_status = v_old_status then raise exception 'invalid_transition'; end if;
    if v_old_status = 'draft' and v_new_status = 'in_review' and exists(
      select 1 from public.article_reviews r where r.article_id = p_id
        and r.content_version = v_old.content_version
    ) then raise exception 'invalid_transition'; end if;
    if (p_expected_version is not null or v_new_status = 'published')
      and p_expected_version is distinct from v_old.content_version then raise exception 'stale_version'; end if;
    if not coalesce(
      (v_old_status = 'draft' and v_new_status = 'in_review' and v_edit
        and (not v_old.requires_scientific_review or v_old.scientific_reviewer_id is not null))
      or (v_old_status = 'changes_requested' and v_new_status = 'draft' and v_edit)
      or (v_old_status = 'in_review' and v_new_status = 'draft' and (v_review or v_edit))
      or (v_old_status = 'approved' and v_new_status = 'draft' and (v_review or v_publish))
      or (v_old_status = 'approved' and v_new_status = 'published' and v_publish)
      or (v_old_status = 'published' and v_new_status in ('draft', 'archived') and v_publish)
      or (v_old_status = 'archived' and v_new_status = 'draft' and v_publish), false)
      then raise exception 'forbidden'; end if;
    if v_new_status = 'published' and (v_old.approved_version is distinct from v_old.content_version
      or (select count(*) from public.article_translations where article_id = p_id) <> 2
      or (v_old.requires_scientific_review and not exists(
        select 1 from public.article_reviews r where r.article_id = p_id
          and r.content_version = v_old.content_version and r.decision = 'approved'
          and r.reviewer_id = v_old.scientific_reviewer_id)))
      then raise exception 'invalid_transition'; end if;
    update public.articles set status = p_status, updated_by = v_actor,
      approved_version = case when v_new_status in ('draft', 'in_review') then null else approved_version end,
      published_at = case when v_new_status = 'published' then now() else published_at end,
      first_published_at = case when v_new_status = 'published' then coalesce(first_published_at, now()) else first_published_at end
      where id = p_id;
  end if;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, old_data, new_data)
    values (v_actor, 'article', p_id, case when p_delete then 'article.soft_delete' else 'article.status.change' end,
      jsonb_build_object('status', v_old.status, 'version', v_old.content_version),
      jsonb_build_object('status', p_status, 'deleted', p_delete, 'version', v_old.content_version));
end;
$$;

revoke all on function public.configure_article_review(uuid, boolean, uuid),
  public.submit_article_review(uuid, integer, text, text), public.list_article_reviews(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.configure_article_review(uuid, boolean, uuid),
  public.submit_article_review(uuid, integer, text, text), public.list_article_reviews(uuid)
  to authenticated;

revoke all on function public.assign_article_reviewer(uuid, uuid),
  public.change_article_state(uuid, public.article_status, boolean, integer)
  from public, anon, service_role;
grant execute on function public.assign_article_reviewer(uuid, uuid),
  public.change_article_state(uuid, public.article_status, boolean, integer)
  to authenticated;
