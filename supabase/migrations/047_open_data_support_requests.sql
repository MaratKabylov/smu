-- Migration 047: Open Data feedback and request forms (open_data_offer, open_data_request)
begin;

-- 1. Extend permissions
insert into public.permissions(code, name) values
  ('open_data_offers.manage', 'Обработка предложений данных'),
  ('open_data_requests.manage', 'Обработка запросов данных')
on conflict(code) do update set name = excluded.name;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code in ('admin', 'super_admin')
  and p.code in ('open_data_offers.manage', 'open_data_requests.manage')
on conflict do nothing;

-- 2. Extend support_requests check constraint
alter table public.support_requests drop constraint if exists support_requests_kind_check;
alter table public.support_requests add constraint support_requests_kind_check
  check (kind in ('research_proposal', 'it_request', 'publication_support', 'open_data_offer', 'open_data_request'));

-- 3. Update smu_support_permission and smu_can_manage_support functions
create or replace function public.smu_support_permission(p_kind text) returns text
language sql immutable set search_path='' as $$
select case p_kind
  when 'research_proposal' then 'research_proposals.manage'
  when 'it_request' then 'it_requests.manage'
  when 'publication_support' then 'publication_support.manage'
  when 'open_data_offer' then 'open_data_offers.manage'
  when 'open_data_request' then 'open_data_requests.manage'
end $$;

create or replace function public.smu_can_manage_support(p_actor uuid, p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
select public.smu_support_permission(p_kind) is not null
  and (
    exists(
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p_actor and r.code = 'super_admin'
    )
    or (
      exists(
        select 1 from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = p_actor and p.code = 'admin.access'
      )
      and exists(
        select 1 from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = p_actor and p.code = public.smu_support_permission(p_kind)
      )
    )
  )
$$;

revoke all on function public.smu_support_permission(text), public.smu_can_manage_support(uuid, text)
  from public, anon, authenticated, service_role;

-- 4. Update submit_support_request function (enforces no files for Open Data kinds)
create or replace function public.submit_support_request(p_id uuid, p_input jsonb, p_files jsonb, p_owner uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_kind text := p_input->>'kind';
  v_email text := lower(btrim(p_input->>'email'));
  v_keys text[];
  v_key text;
  v_details jsonb := '{}';
  v_file jsonb;
begin
  if p_id is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text) > 150000
    or public.smu_support_permission(v_kind) is null or p_input->>'locale' is null or p_input->>'locale' not in ('ru','kk','en')
    or (p_input->'consent') is distinct from 'true'::jsonb then
    raise exception 'invalid_input';
  end if;

  foreach v_key in array array['title', 'description', 'contactName', 'email', 'organization'] loop
    if jsonb_typeof(p_input->v_key) is distinct from 'string' then
      raise exception 'invalid_input';
    end if;
  end loop;

  if length(btrim(p_input->>'title')) not between 3 and 200
    or length(btrim(p_input->>'description')) not between 20 and 20000
    or length(btrim(p_input->>'contactName')) not between 2 and 160
    or length(p_input->>'organization') > 200 or length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or jsonb_typeof(p_input->'details') is distinct from 'object' then
    raise exception 'invalid_input';
  end if;

  v_keys := case v_kind
    when 'research_proposal' then array['importance', 'region', 'availableData']
    when 'it_request' then array['currentProcess', 'desiredSolution', 'dataDescription']
    when 'publication_support' then array['journal', 'manuscriptStage', 'supportNeeded']
    when 'open_data_offer' then array['category', 'dataFormat', 'periodAndSource']
    when 'open_data_request' then array['requestedData', 'researchGoal', 'periodOrFormat']
  end;

  foreach v_key in array v_keys loop
    if jsonb_typeof(p_input->'details'->v_key) is distinct from 'string'
      or length(btrim(p_input->'details'->>v_key)) not between 2 and 5000 then
      raise exception 'invalid_input';
    end if;
    v_details := v_details || jsonb_build_object(v_key, btrim(p_input->'details'->>v_key));
  end loop;

  if p_owner is not null and not exists(
    select 1 from auth.users u
    where u.id = p_owner
      and nullif(to_jsonb(u)->>'email_confirmed_at', '') is not null
      and coalesce((to_jsonb(u)->>'is_anonymous')::boolean, false) = false
      and lower(btrim(u.email)) = v_email
  ) then
    raise exception 'forbidden';
  end if;

  if jsonb_typeof(p_files) is distinct from 'array' then
    raise exception 'invalid_input';
  end if;
  if v_kind in ('open_data_offer', 'open_data_request') and jsonb_array_length(p_files) > 0 then
    raise exception 'invalid_file';
  end if;
  if jsonb_array_length(p_files) > 3 then
    raise exception 'invalid_input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('support:' || v_email, 0));
  if (select count(*) from public.support_requests where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited';
  end if;

  insert into public.support_requests(id, kind, owner_id, locale, title, description, contact_name, email, organization, details)
  values(p_id, v_kind, p_owner, p_input->>'locale', btrim(p_input->>'title'), btrim(p_input->>'description'), btrim(p_input->>'contactName'), v_email, btrim(p_input->>'organization'), v_details);

  for v_file in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(v_file) is distinct from 'object' or v_file->>'id' is null
      or v_file->>'path' is distinct from p_id::text || '/' || (v_file->>'id')
      or jsonb_typeof(v_file->'name') is distinct from 'string' or v_file->>'name' !~* '\.pdf$'
      or v_file->>'mimeType' is distinct from 'application/pdf'
      or jsonb_typeof(v_file->'size') is distinct from 'number' then
      raise exception 'invalid_file';
    end if;
    insert into public.support_request_files(id, request_id, storage_path, name, size, mime_type)
    values((v_file->>'id')::uuid, p_id, v_file->>'path', v_file->>'name', (v_file->>'size')::integer, v_file->>'mimeType');
  end loop;

  insert into public.audit_logs(user_id, entity_type, entity_id, action, new_data)
  values(p_owner, 'support_request', p_id, 'submit', jsonb_build_object('kind', v_kind, 'status', 'new', 'fileCount', jsonb_array_length(p_files), 'policy', 'support-v1'));

  return p_id;
end $$;

revoke all on function public.submit_support_request(uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_support_request(uuid, jsonb, jsonb, uuid) to service_role;

-- 5. Update smu_notification_copy
create or replace function public.smu_notification_copy(p_type text, p_locale text, p_status text default '', p_kind text default '')
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  v_locale text := case when p_locale in ('ru', 'kk', 'en') then p_locale else 'ru' end;
  v_kind text;
  v_status text;
begin
  v_kind := case p_kind
    when 'mentorship' then case v_locale when 'kk' then 'Тәлімгерлік өтінімі' when 'en' then 'Mentorship application' else 'Заявка на наставничество' end
    when 'research_program' then case v_locale when 'kk' then 'Research Program өтінімі' when 'en' then 'Research Program application' else 'Заявка в Research Program' end
    when 'research_proposal' then case v_locale when 'kk' then 'Зерттеу ұсынысы' when 'en' then 'Research proposal' else 'Исследовательское предложение' end
    when 'it_request' then case v_locale when 'kk' then 'IT өтінімі' when 'en' then 'IT request' else 'IT-заявка' end
    when 'publication_support' then case v_locale when 'kk' then 'Жарияланымға қолдау өтінімі' when 'en' then 'Publication support request' else 'Заявка на поддержку публикации' end
    when 'open_data_offer' then case v_locale when 'kk' then 'Деректер ұсыну өтінімі' when 'en' then 'Data contribution request' else 'Заявка на передачу данных' end
    when 'open_data_request' then case v_locale when 'kk' then 'Деректерге сұраныс өтінімі' when 'en' then 'Data request' else 'Заявка на получение данных' end
    else case v_locale when 'kk' then 'Өтінім' when 'en' then 'Application' else 'Заявка' end
  end;

  v_status := case p_status
    when 'new' then case v_locale when 'kk' then 'қабылданды' when 'en' then 'received' else 'получена' end
    when 'in_review' then case v_locale when 'kk' then 'қаралуда' when 'en' then 'under review' else 'на рассмотрении' end
    when 'in_progress' then case v_locale when 'kk' then 'орындалуда' when 'en' then 'in progress' else 'в работе' end
    when 'accepted' then case v_locale when 'kk' then 'қабылданды' when 'en' then 'accepted' else 'принята' end
    when 'completed' then case v_locale when 'kk' then 'аяқталды' when 'en' then 'completed' else 'завершена' end
    when 'rejected' then case v_locale when 'kk' then 'қабылданбады' when 'en' then 'declined' else 'отклонена' end
    when 'withdrawn' then case v_locale when 'kk' then 'қайтарып алынды' when 'en' then 'withdrawn' else 'отозвана' end
    else p_status
  end;

  if p_type = 'application_received' then
    return jsonb_build_object('title', v_kind,
      'message', case v_locale when 'kk' then 'Өтініміңіз қабылданды. Күй өзгергенде хабарлаймыз.' when 'en' then 'Your application was received. We will notify you when its status changes.' else 'Ваша заявка получена. Мы сообщим, когда её статус изменится.' end);
  elsif p_type = 'application_status' then
    return jsonb_build_object('title', v_kind,
      'message', case v_locale when 'kk' then 'Жаңа күй: ' || v_status || '.' when 'en' then 'New status: ' || v_status || '.' else 'Новый статус: ' || v_status || '.' end);
  elsif p_type = 'manager_new_request' then
    return jsonb_build_object('title',
      case v_locale when 'kk' then 'Жаңа өтінім' when 'en' then 'New application' else 'Новая заявка' end,
      'message', v_kind || case v_locale when 'kk' then ' жұмыс кезегіне түсті.' when 'en' then ' was added to the work queue.' else ' поступила в рабочую очередь.' end);
  elsif p_type = 'assignment' then
    return jsonb_build_object('title',
      case v_locale when 'kk' then 'Сізге өтінім тағайындалды' when 'en' then 'Application assigned to you' else 'Вам назначена заявка' end,
      'message', v_kind || case v_locale when 'kk' then ' сізге тағайындалды.' when 'en' then ' was assigned to you.' else ' назначена вам.' end);
  end if;

  raise exception 'invalid_notification';
end $$;

revoke all on function public.smu_notification_copy(text, text, text, text)
  from public, anon, authenticated, service_role;

-- 6. Update read_admin_dashboard for open data queues
create or replace function public.read_admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_metrics jsonb := '{}';
  v_own jsonb := '[]';
  v_review jsonb := '[]';
  v_audit jsonb := '[]';
  v_global boolean;
  v_can_review boolean;
begin
  if v_actor is null or not public.has_permission('admin.access') then
    raise exception 'forbidden';
  end if;
  v_global := public.has_permission('articles.edit_any') or public.has_permission('articles.publish');
  v_can_review := public.has_permission('articles.review');

  if public.has_permission('scientists.edit') or public.has_permission('scientists.verify') then
    v_metrics := v_metrics || jsonb_build_object('scientists', (select count(*) from public.scientist_profiles where deleted_at is null));
  end if;
  if public.has_permission('scientists.verify') then
    v_metrics := v_metrics || jsonb_build_object('pending_scientists', (select count(*) from public.scientist_profiles where deleted_at is null and verification_status = 'pending'));
  end if;
  if public.has_permission('research.manage') then
    v_metrics := v_metrics || jsonb_build_object('active_research', (select count(*) from public.science_works where kind = 'research' and stage = 'active' and deleted_at is null and status <> 'archived'));
  end if;
  if public.has_permission('projects.manage') then
    v_metrics := v_metrics || jsonb_build_object('active_projects', (select count(*) from public.science_works where kind = 'project' and stage = 'active' and deleted_at is null and status <> 'archived'));
  end if;
  if public.has_permission('mentorship.manage') then
    v_metrics := v_metrics || jsonb_build_object('mentorship_applications', (select count(*) from public.mentorship_applications where status = 'new' and deleted_at is null));
  end if;
  if public.has_permission('research_program.manage') then
    v_metrics := v_metrics || jsonb_build_object('program_applications', (select count(*) from public.research_program_applications where status = 'new' and deleted_at is null));
  end if;
  if public.has_permission('research_proposals.manage') then
    v_metrics := v_metrics || jsonb_build_object('research_proposals', (select count(*) from public.support_requests where kind = 'research_proposal' and status = 'new'));
  end if;
  if public.has_permission('it_requests.manage') then
    v_metrics := v_metrics || jsonb_build_object('it_requests', (select count(*) from public.support_requests where kind = 'it_request' and status = 'new'));
  end if;
  if public.has_permission('publication_support.manage') then
    v_metrics := v_metrics || jsonb_build_object('publication_requests', (select count(*) from public.support_requests where kind = 'publication_support' and status = 'new'));
  end if;
  if public.has_permission('open_data_offers.manage') then
    v_metrics := v_metrics || jsonb_build_object('open_data_offers', (select count(*) from public.support_requests where kind = 'open_data_offer' and status = 'new'));
  end if;
  if public.has_permission('open_data_requests.manage') then
    v_metrics := v_metrics || jsonb_build_object('open_data_requests', (select count(*) from public.support_requests where kind = 'open_data_request' and status = 'new'));
  end if;
  if v_global then
    v_metrics := v_metrics || jsonb_build_object('article_drafts', (select count(*) from public.articles where status = 'draft' and deleted_at is null));
  end if;
  if v_can_review then
    v_metrics := v_metrics || jsonb_build_object('review_articles', (select count(*) from public.articles
      where status = 'in_review' and deleted_at is null and (v_global or scientific_reviewer_id = v_actor)));
    select coalesce(jsonb_agg(item order by updated_at desc, id), '[]'::jsonb) into v_review from (
      select a.id, a.updated_at, jsonb_build_object('id', a.id, 'title', coalesce(t.title, a.id::text)) item
      from public.articles a left join lateral (select title from public.article_translations where article_id = a.id
        order by (locale = 'ru') desc, locale limit 1) t on true
      where a.status = 'in_review' and a.deleted_at is null and (v_global or a.scientific_reviewer_id = v_actor)
      order by a.updated_at desc, a.id limit 5
    ) rows;
  end if;
  if public.has_permission('articles.edit_own') or v_global then
    v_metrics := v_metrics || jsonb_build_object('own_drafts', (select count(*) from public.articles where author_id = v_actor and status = 'draft' and deleted_at is null));
    select coalesce(jsonb_agg(item order by updated_at desc, id), '[]'::jsonb) into v_own from (
      select a.id, a.updated_at, jsonb_build_object('id', a.id, 'title', coalesce(t.title, a.id::text)) item
      from public.articles a left join lateral (select title from public.article_translations where article_id = a.id
        order by (locale = 'ru') desc, locale limit 1) t on true
      where a.author_id = v_actor and a.status = 'draft' and a.deleted_at is null
      order by a.updated_at desc, a.id limit 5
    ) rows;
  end if;
  if public.has_permission('events.manage') then
    v_metrics := v_metrics || jsonb_build_object('upcoming_events', (select count(*) from public.events
      where status = 'published' and published_at <= now() and starts_at > now() and deleted_at is null));
  end if;
  if public.has_permission('opportunities.manage') then
    v_metrics := v_metrics || jsonb_build_object('expiring_opportunities', (select count(*) from public.opportunities
      where status = 'published' and published_at <= now() and deadline > now() and deadline <= now() + interval '7 days' and deleted_at is null));
  end if;

  if public.has_permission('audit.read') then
    select coalesce(jsonb_agg(item order by created_at desc, id desc), '[]'::jsonb) into v_audit from (
      select l.id, l.created_at, jsonb_build_object('id', l.id, 'created_at', l.created_at, 'entity_type', l.entity_type, 'action', l.action) item
      from public.audit_logs l order by l.created_at desc, l.id desc limit 5
    ) rows;
  end if;

  return jsonb_build_object(
    'metrics', v_metrics,
    'ownDrafts', v_own,
    'reviewQueue', v_review,
    'recentActions', v_audit
  );
end $$;

revoke all on function public.read_admin_dashboard() from public, anon, authenticated, service_role;
grant execute on function public.read_admin_dashboard() to authenticated;

commit;
