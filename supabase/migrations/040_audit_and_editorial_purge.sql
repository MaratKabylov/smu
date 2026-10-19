-- Expose audit metadata through a session-scoped RPC. Historical snapshots may
-- contain private application/contact data and are never returned to the UI.
revoke select on public.audit_logs from public, anon, authenticated, service_role;
revoke insert on public.audit_logs from public, anon, authenticated;
revoke update, delete, truncate on public.audit_logs from public, anon, authenticated, service_role;
revoke delete, truncate on public.articles, public.scientist_profiles from public, anon, authenticated, service_role;
create index audit_logs_order_idx on public.audit_logs(created_at desc, id desc);
create index audit_logs_actor_idx on public.audit_logs(user_id, created_at desc);

create function public.list_audit_records(p_entity_type text default '', p_action text default '',
  p_actor uuid default null, p_entity_id uuid default null, p_from date default null,
  p_until date default null, p_page integer default 1)
returns table(id uuid, user_id uuid, entity_type text, entity_id uuid, action text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_smu_session();
  if not public.has_permission('audit.read') then raise exception 'forbidden'; end if;
  if p_entity_type is null or length(p_entity_type)>80 or p_action is null or length(p_action)>120
    or p_page is null or p_page not between 1 and 10000 or (p_from is not null and p_until is not null and p_from>p_until)
    then raise exception 'invalid_input'; end if;
  return query select a.id,a.user_id,a.entity_type,a.entity_id,a.action,a.created_at
  from public.audit_logs a
  where (p_entity_type='' or a.entity_type=p_entity_type) and (p_action='' or a.action=p_action)
    and (p_actor is null or a.user_id=p_actor) and (p_entity_id is null or a.entity_id=p_entity_id)
    and (p_from is null or a.created_at >= (p_from::timestamp at time zone 'UTC'))
    and (p_until is null or a.created_at < ((p_until+1)::timestamp at time zone 'UTC'))
  order by a.created_at desc,a.id desc limit 51 offset (p_page-1)*50;
end;
$$;
revoke all on function public.list_audit_records(text,text,uuid,uuid,date,date,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_audit_records(text,text,uuid,uuid,date,date,integer) to authenticated;

-- The locked parent prevents new FK references. Refuse even SET NULL/CASCADE
-- dependencies outside the record's own detail tables, rather than lose science
-- history or silently detach another record. New referencing tables fail closed.
create function public.assert_editorial_purge_unreferenced(p_table text,p_id uuid,p_owned text[])
returns void language plpgsql security invoker set search_path = '' as $$
declare v_fk record; v_exists boolean;
begin
  for v_fk in
    select n.nspname,c.relname,a.attname from pg_catalog.pg_constraint f
    join pg_catalog.pg_class c on c.oid=f.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=f.conrelid and a.attnum=any(f.conkey)
    where f.contype='f' and f.confrelid=p_table::regclass
      and not (n.nspname='public' and c.relname=any(p_owned))
  loop
    execute format('select exists(select 1 from %I.%I where %I=$1)',v_fk.nspname,v_fk.relname,v_fk.attname)
      into v_exists using p_id;
    if v_exists then raise exception 'record_in_use'; end if;
  end loop;
end;
$$;
revoke all on function public.assert_editorial_purge_unreferenced(text,uuid,text[]) from public,anon,authenticated,service_role;

create function public.purge_deleted_editorial_record(p_kind text,p_id uuid,p_expected_deleted_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.require_smu_session(); v_deleted timestamptz; v_locale text;
begin
  -- Lock role assignments against concurrent revocation, then check current role.
  lock table public.user_roles in share mode;
  if not public.has_permission('admin.access') or not exists(select 1 from public.user_roles ur
    join public.roles r on r.id=ur.role_id where ur.user_id=v_actor and r.code='super_admin')
    then raise exception 'forbidden'; end if;
  if p_kind is null or p_kind not in ('article','scientist') or p_id is null or p_expected_deleted_at is null
    then raise exception 'invalid_input'; end if;
  if p_kind='article' then
    select deleted_at into v_deleted from public.articles where id=p_id for update;
  else
    select deleted_at into v_deleted from public.scientist_profiles where id=p_id for update;
  end if;
  if not found then raise exception 'not_found'; end if;
  if v_deleted is null or v_deleted is distinct from p_expected_deleted_at then raise exception 'stale_version'; end if;
  -- Serialize tombstones with save/restore slug reservations. Without this a
  -- concurrent save could check history before purge and insert after deletion.
  for v_locale in
    select locale from public.article_translations where article_id=p_id and p_kind='article'
    union select locale from public.scientist_profile_translations where scientist_profile_id=p_id and p_kind='scientist'
    order by locale
  loop
    perform pg_advisory_xact_lock(hashtextextended('smu_slug:' || p_kind || ':' || v_locale,0));
  end loop;
  if p_kind='article' then
    perform public.assert_editorial_purge_unreferenced('public.articles',p_id,array['article_translations',
      'article_tag_links','article_category_links','article_authors','article_revisions','article_scientists',
      'article_projects','article_research','article_events','article_publications','article_reviews']);
    insert into public.slug_redirects(entity_type,entity_id,locale,old_slug)
      select 'article',p_id,locale,slug from public.article_translations where article_id=p_id on conflict do nothing;
    delete from public.articles where id=p_id;
  else
    perform public.assert_editorial_purge_unreferenced('public.scientist_profiles',p_id,
      array['scientist_profile_translations','scientist_field_links','scientist_links']);
    insert into public.slug_redirects(entity_type,entity_id,locale,old_slug)
      select 'scientist',p_id,locale,slug from public.scientist_profile_translations where scientist_profile_id=p_id on conflict do nothing;
    delete from public.scientist_profiles where id=p_id;
  end if;
  delete from public.media_usages where entity_type=p_kind and entity_id=p_id;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data)
    values(v_actor,p_kind,p_id,'purged',jsonb_build_object('deleted_at',v_deleted));
end;
$$;
revoke all on function public.purge_deleted_editorial_record(text,uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.purge_deleted_editorial_record(text,uuid,timestamptz) to authenticated;
