-- Homepage results expose only the current public version linked to a visible work.
begin;
create function public.list_homepage_results(p_locale text, p_limit integer default 3)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if p_locale is null or p_locale not in ('ru','kk','en') or p_limit is null or p_limit not between 1 and 12 then
    raise exception 'invalid_input';
  end if;
  select coalesce(jsonb_agg(item order by published_at desc,id),'[]'::jsonb) into v_result from (
    select o.id,o.published_at,jsonb_build_object('id',o.id,'title',v.snapshot->p_locale->>'title',
      'summary',left(v.snapshot->p_locale->>'description',600),
      'href','/'||p_locale||'/'||case w.kind when 'project' then 'projects' else 'research' end||'/'||t.slug||'#results') item
    from public.research_outputs o
    join public.research_output_versions v on v.output_id=o.id and v.version=o.version
    cross join lateral (
      select sw.id,sw.kind from public.research_output_works r join public.science_works sw on sw.id=r.work_id
      where r.output_id=o.id and sw.status='published' and sw.published_at<=now() and sw.deleted_at is null
        and exists(select 1 from public.science_work_translations tr where tr.work_id=sw.id and tr.locale=p_locale)
      order by sw.id limit 1
    ) w
    join public.science_work_translations t on t.work_id=w.id and t.locale=p_locale
    where o.status='published' and o.published_at<=now() and v.snapshot ? p_locale
    order by o.published_at desc,o.id limit p_limit
  ) visible;
  return v_result;
end $$;
revoke all on function public.list_homepage_results(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_homepage_results(text,integer) to anon,authenticated;

-- Keep time filtering in the DB so cached public requests have stable keys.
create function public.list_homepage_events(p_locale text, p_limit integer default 3)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if p_locale is null or p_locale not in ('ru','kk','en') or p_limit is null or p_limit not between 1 and 12 then
    raise exception 'invalid_input';
  end if;
  select coalesce(jsonb_agg(item order by starts_at,id),'[]'::jsonb) into v_result from (
    select e.id,e.starts_at,jsonb_build_object('id',e.id,'title',t.title,'summary',t.summary,
      'href','/'||p_locale||'/events/'||t.slug) item
    from public.events e join public.event_translations t on t.event_id=e.id and t.locale=p_locale
    where e.status='published' and e.published_at<=now() and e.ends_at>now() and e.deleted_at is null
    order by e.starts_at,e.id limit p_limit
  ) visible;
  return v_result;
end $$;
revoke all on function public.list_homepage_events(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_homepage_events(text,integer) to anon,authenticated;

-- Session-only projection: every metric is checked separately. No raw rows,
-- contacts or content snapshots are returned through the administrative summary.
create function public.read_admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_metrics jsonb:='{}'; v_own jsonb:='[]'; v_review jsonb:='[]'; v_audit jsonb:='[]';
  v_global boolean; v_can_review boolean;
begin
  if v_actor is null or not public.has_permission('admin.access') then raise exception 'forbidden'; end if;
  v_global:=public.has_permission('articles.edit_any') or public.has_permission('articles.publish');
  v_can_review:=public.has_permission('articles.review');
  if public.has_permission('scientists.edit') or public.has_permission('scientists.verify') then
    v_metrics:=v_metrics||jsonb_build_object('scientists',(select count(*) from public.scientist_profiles where deleted_at is null));
  end if;
  if public.has_permission('scientists.verify') then
    v_metrics:=v_metrics||jsonb_build_object('pending_scientists',(select count(*) from public.scientist_profiles where deleted_at is null and verification_status='pending'));
  end if;
  if public.has_permission('research.manage') then
    v_metrics:=v_metrics||jsonb_build_object('active_research',(select count(*) from public.science_works where kind='research' and stage='active' and deleted_at is null and status<>'archived'));
  end if;
  if public.has_permission('projects.manage') then
    v_metrics:=v_metrics||jsonb_build_object('active_projects',(select count(*) from public.science_works where kind='project' and stage='active' and deleted_at is null and status<>'archived'));
  end if;
  if public.has_permission('mentorship.manage') then
    v_metrics:=v_metrics||jsonb_build_object('mentorship_applications',(select count(*) from public.mentorship_applications where status='new' and deleted_at is null));
  end if;
  if public.has_permission('research_program.manage') then
    v_metrics:=v_metrics||jsonb_build_object('program_applications',(select count(*) from public.research_program_applications where status='new' and deleted_at is null));
  end if;
  if public.has_permission('research_proposals.manage') then
    v_metrics:=v_metrics||jsonb_build_object('research_proposals',(select count(*) from public.support_requests where kind='research_proposal' and status='new'));
  end if;
  if public.has_permission('it_requests.manage') then
    v_metrics:=v_metrics||jsonb_build_object('it_requests',(select count(*) from public.support_requests where kind='it_request' and status='new'));
  end if;
  if public.has_permission('publication_support.manage') then
    v_metrics:=v_metrics||jsonb_build_object('publication_requests',(select count(*) from public.support_requests where kind='publication_support' and status='new'));
  end if;
  if v_global then
    v_metrics:=v_metrics||jsonb_build_object('article_drafts',(select count(*) from public.articles where status='draft' and deleted_at is null),
      'scheduled_articles',(select count(*) from public.articles where status='scheduled' and deleted_at is null));
  end if;
  if v_can_review then
    v_metrics:=v_metrics||jsonb_build_object('review_articles',(select count(*) from public.articles
      where status='in_review' and deleted_at is null and (v_global or scientific_reviewer_id=v_actor)));
    select coalesce(jsonb_agg(item order by updated_at desc,id),'[]'::jsonb) into v_review from (
      select a.id,a.updated_at,jsonb_build_object('id',a.id,'title',coalesce(t.title,a.id::text)) item
      from public.articles a left join lateral (select title from public.article_translations where article_id=a.id
        order by (locale='ru') desc,locale limit 1) t on true
      where a.status='in_review' and a.deleted_at is null and (v_global or a.scientific_reviewer_id=v_actor)
      order by a.updated_at desc,a.id limit 5
    ) rows;
  end if;
  if public.has_permission('articles.edit_own') or v_global then
    v_metrics:=v_metrics||jsonb_build_object('own_drafts',(select count(*) from public.articles where author_id=v_actor and status='draft' and deleted_at is null));
    select coalesce(jsonb_agg(item order by updated_at desc,id),'[]'::jsonb) into v_own from (
      select a.id,a.updated_at,jsonb_build_object('id',a.id,'title',coalesce(t.title,a.id::text)) item
      from public.articles a left join lateral (select title from public.article_translations where article_id=a.id
        order by (locale='ru') desc,locale limit 1) t on true
      where a.author_id=v_actor and a.status='draft' and a.deleted_at is null
      order by a.updated_at desc,a.id limit 5
    ) rows;
  end if;
  if public.has_permission('events.manage') then
    v_metrics:=v_metrics||jsonb_build_object('upcoming_events',(select count(*) from public.events
      where status='published' and published_at<=now() and starts_at>now() and deleted_at is null));
  end if;
  if public.has_permission('opportunities.manage') then
    v_metrics:=v_metrics||jsonb_build_object('expiring_opportunities',(select count(*) from public.opportunities
      where status='published' and published_at<=now() and deadline>now() and deadline<=now()+interval '7 days' and deleted_at is null));
  end if;
  if public.has_permission('audit.read') then
    select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into v_audit from (
      select a.id,a.created_at,jsonb_build_object('id',a.id,'created_at',a.created_at,'entity_type',a.entity_type,'action',a.action) item
      from public.audit_logs a order by a.created_at desc,a.id desc limit 5
    ) rows;
  end if;
  return jsonb_build_object('metrics',v_metrics,'ownDrafts',v_own,'reviewQueue',v_review,'recentActions',v_audit);
end $$;
revoke all on function public.read_admin_dashboard() from public,anon,authenticated,service_role;
grant execute on function public.read_admin_dashboard() to authenticated;
commit;
