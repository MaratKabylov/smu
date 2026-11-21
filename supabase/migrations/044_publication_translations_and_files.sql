-- Migration 044: Publication translations (RU/KK/EN) and PDF file attachment
alter table public.publications
  add column if not exists file_media_id uuid references public.media_assets(id) on delete set null;

grant select(file_media_id) on public.publications to anon, authenticated;
grant select on public.publications to anon, authenticated;
grant all on public.publications to service_role;

create table if not exists public.publication_translations (
  publication_id uuid not null references public.publications(id) on delete cascade,
  locale text not null check(locale in ('ru','kk','en')),
  slug text not null check(length(slug) between 2 and 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check(length(trim(title)) between 3 and 500),
  summary text not null default '' check(length(trim(summary)) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(publication_id, locale),
  unique(locale, slug)
);

create index if not exists publication_translations_slug_idx on public.publication_translations(locale, slug);

alter table public.publication_translations enable row level security;
revoke all on public.publication_translations from public, anon, authenticated, service_role;
grant select on public.publication_translations to anon, authenticated;
grant all on public.publication_translations to service_role;

drop policy if exists publication_translations_public on public.publication_translations;
create policy publication_translations_public on public.publication_translations for select to anon, authenticated using (
  exists (
    select 1 from public.publications p
    join public.scientist_profiles s on s.id = p.scientist_id
    where p.id = publication_id and p.status = 'published' and p.deleted_at is null and p.published_at <= now()
      and s.status = 'verified' and s.is_public and s.deleted_at is null
  )
);

drop policy if exists publication_translations_managers on public.publication_translations;
create policy publication_translations_managers on public.publication_translations for select to authenticated using (
  public.has_permission('admin.access') and public.has_permission('publications.manage')
);

-- Seed initial translations from existing publications
insert into public.publication_translations (publication_id, locale, slug, title, summary)
select
  p.id,
  'ru',
  'pub-' || substr(p.id::text, 1, 8),
  p.title,
  coalesce(p.journal || ', ' || p.year, '')
from public.publications p
on conflict do nothing;

create or replace function public.save_publication(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := public.require_smu_session();
  v_id uuid;
  v_old public.publications%rowtype;
  v_scientist uuid;
  v_authors jsonb := coalesce(p_input->'coauthors', '[]');
  v_works jsonb := coalesce(p_input->'workIds', '[]');
  v_translations jsonb := p_input->'translations';
  v_file_media_id uuid := nullif(p_input->>'fileMediaId', '')::uuid;
  v_author jsonb;
  v_trans jsonb;
  v_index integer := 0;
  v_old_links jsonb;
  v_main_title text := btrim(coalesce(p_input->>'title', ''));
begin
  if not public.has_permission('publications.manage') then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(v_authors) is distinct from 'array' or jsonb_typeof(v_works) is distinct from 'array'
    then raise exception 'invalid_input'; end if;
  if jsonb_array_length(v_authors) > 30 or jsonb_array_length(v_works) > 20
    or coalesce(p_input->>'status', '') not in ('draft', 'published', 'archived')
    or coalesce(p_input->>'publicationType', '') not in ('article', 'conference', 'book', 'chapter', 'other')
    or coalesce(length(btrim(p_input->>'journal')), 0) not between 2 and 240
    or coalesce((p_input->>'year')::integer, 0) not between 1800 and 2200
    then raise exception 'invalid_input'; end if;

  if v_translations is not null and jsonb_typeof(v_translations) = 'array' and jsonb_array_length(v_translations) > 0 then
    if v_main_title = '' then
      v_main_title := btrim(coalesce(v_translations->0->>'title', ''));
    end if;
  end if;
  if length(v_main_title) not between 3 and 500 then raise exception 'invalid_input'; end if;

  if v_file_media_id is not null then
    if not exists (select 1 from public.media_assets where id = v_file_media_id and deleted_at is null and status = 'ready') then
      raise exception 'invalid_reference';
    end if;
  end if;

  v_scientist := (p_input->>'scientistId')::uuid;
  for v_author in select value from jsonb_array_elements(v_authors) loop
    if jsonb_typeof(v_author) is distinct from 'object' or exists(select 1 from jsonb_object_keys(v_author) k where k not in ('scientistId','name','affiliation'))
      or (v_author->>'scientistId' is not null and (coalesce(v_author->>'name','')<>'' or coalesce(v_author->>'affiliation','')<>''))
      or (v_author->>'scientistId' is null and (jsonb_typeof(v_author->'name') is distinct from 'string'
        or length(btrim(v_author->>'name')) not between 2 and 240))
      or (v_author ? 'affiliation' and jsonb_typeof(v_author->'affiliation') is distinct from 'string')
      or length(coalesce(v_author->>'affiliation',''))>240 then raise exception 'invalid_input'; end if;
  end loop;

  if exists(select 1 from jsonb_array_elements(v_works) a where jsonb_typeof(a.value)<>'string')
    or (select count(*) from jsonb_array_elements_text(v_works))<>(select count(distinct value::uuid) from jsonb_array_elements_text(v_works))
    or (select count(*) from jsonb_array_elements(v_authors) a where a.value->>'scientistId' is not null)<>
      (select count(distinct (a.value->>'scientistId')::uuid) from jsonb_array_elements(v_authors) a)
    or exists(select 1 from jsonb_array_elements(v_authors) a where (a.value->>'scientistId')::uuid=v_scientist)
    then raise exception 'invalid_input'; end if;

  perform 1 from public.scientist_profiles where id=v_scientist or id in
    (select (a.value->>'scientistId')::uuid from jsonb_array_elements(v_authors) a) order by id for share;
  if not exists(select 1 from public.scientist_profiles where id=v_scientist and status='verified' and is_public and deleted_at is null)
    or exists(select 1 from jsonb_array_elements(v_authors) a where a.value->>'scientistId' is not null and not exists(
      select 1 from public.scientist_profiles s where s.id=(a.value->>'scientistId')::uuid and s.status='verified' and s.is_public and s.deleted_at is null))
    then raise exception 'invalid_reference'; end if;

  perform 1 from public.science_works where id in(select value::uuid from jsonb_array_elements_text(v_works)) order by id for share;
  if exists(select 1 from jsonb_array_elements_text(v_works) a where not exists(
    select 1 from public.science_works w where w.id=a.value::uuid and w.status='published' and w.deleted_at is null and w.published_at<=now()))
    then raise exception 'invalid_reference'; end if;

  if p_id is not null then
    select * into v_old from public.publications where id=p_id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    if (p_input->>'expectedUpdatedAt')::timestamptz is distinct from v_old.updated_at then raise exception 'stale_version'; end if;
    select jsonb_build_object('coauthors',coalesce((select jsonb_agg(to_jsonb(a) order by sort_order) from public.publication_coauthors a where publication_id=p_id),'[]'),
      'workIds',coalesce((select jsonb_agg(work_id order by work_id) from public.publication_works where publication_id=p_id),'[]')) into v_old_links;
    v_id:=p_id;
  else
    insert into public.publications(scientist_id,title,year,journal,publication_type,created_by,file_media_id)
      values(v_scientist,v_main_title,(p_input->>'year')::integer,btrim(p_input->>'journal'),p_input->>'publicationType',v_actor,v_file_media_id) returning id into v_id;
  end if;

  update public.publications set scientist_id=v_scientist,title=v_main_title,year=(p_input->>'year')::integer,
    journal=btrim(p_input->>'journal'),doi=nullif(p_input->>'doi',''),url=nullif(p_input->>'url',''),
    publication_type=p_input->>'publicationType',status=p_input->>'status',file_media_id=v_file_media_id,
    published_at=case when p_input->>'status'='published' then coalesce(v_old.published_at,now()) else null end where id=v_id;

  delete from public.publication_coauthors where publication_id=v_id;
  for v_author in select value from jsonb_array_elements(v_authors) loop
    insert into public.publication_coauthors(publication_id,sort_order,scientist_id,name,affiliation)
      values(v_id,v_index,(v_author->>'scientistId')::uuid,case when v_author->>'scientistId' is null then btrim(v_author->>'name') end,btrim(coalesce(v_author->>'affiliation','')));
    v_index:=v_index+1;
  end loop;

  delete from public.publication_works where publication_id=v_id;
  insert into public.publication_works select v_id,value::uuid from jsonb_array_elements_text(v_works);

  if v_translations is not null and jsonb_typeof(v_translations) = 'array' then
    for v_trans in select value from jsonb_array_elements(v_translations) loop
      if coalesce(v_trans->>'title','') <> '' and coalesce(v_trans->>'slug','') <> '' then
        insert into public.publication_translations(publication_id, locale, slug, title, summary, updated_at)
        values (
          v_id,
          v_trans->>'locale',
          btrim(v_trans->>'slug'),
          btrim(v_trans->>'title'),
          btrim(coalesce(v_trans->>'summary', '')),
          now()
        )
        on conflict (publication_id, locale) do update
        set slug = excluded.slug, title = excluded.title, summary = excluded.summary, updated_at = now();
      end if;
    end loop;
  end if;

  insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data) values
    (v_actor,'publication',v_id,'publication.save',case when p_id is null then null else to_jsonb(v_old)||v_old_links end,
      jsonb_build_object('title',v_main_title,'scientistId',v_scientist,'status',p_input->>'status','coauthors',v_authors,'workIds',v_works));
  return v_id;
end $$;
revoke all on function public.save_publication(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_publication(uuid,jsonb) to authenticated;

drop function if exists public.list_public_publications(text,uuid,uuid);
create function public.list_public_publications(p_locale text, p_id uuid default null, p_scientist uuid default null)
returns table(id uuid, scientist_id uuid, title text, year integer, journal text, doi text, url text,
  publication_type text, scientist_name text, scientist_href text, summary text, slug text, file_media_id uuid, file_name text, authors jsonb, works jsonb)
language sql stable security definer set search_path='' as $$
  select p.id, p.scientist_id,
    coalesce(pt.title, p.title) as title,
    p.year, p.journal, p.doi, p.url, p.publication_type,
    t.full_name, '/' || t.locale || '/scientists/' || t.slug,
    coalesce(pt.summary, '') as summary,
    coalesce(pt.slug, p.id::text) as slug,
    p.file_media_id,
    m.file_name,
    jsonb_build_array(jsonb_build_object('scientistId', s.id, 'name', t.full_name, 'href', '/' || t.locale || '/scientists/' || t.slug, 'affiliation', '')) ||
      coalesce((select jsonb_agg(jsonb_build_object('scientistId', a.scientist_id, 'name', coalesce(st.full_name, a.name),
        'href', case when st.slug is not null then '/' || st.locale || '/scientists/' || st.slug end, 'affiliation', a.affiliation) order by a.sort_order)
        from public.publication_coauthors a left join public.scientist_profiles cs on cs.id = a.scientist_id
        left join public.scientist_profile_translations st on st.scientist_profile_id = cs.id and st.locale = p_locale
        where a.publication_id = p.id and (a.scientist_id is null or (cs.status = 'verified' and cs.is_public and cs.deleted_at is null and st.slug is not null))), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'kind', w.kind, 'title', wt.title,
        'href', '/' || wt.locale || case when w.kind = 'project' then '/projects/' else '/research/' end || wt.slug) order by wt.title, w.id)
      from public.publication_works l join public.science_works w on w.id = l.work_id
      join public.science_work_translations wt on wt.work_id = w.id and wt.locale = p_locale
      where l.publication_id = p.id and w.status = 'published' and w.deleted_at is null and w.published_at <= now()), '[]')
  from public.publications p
  join public.scientist_profiles s on s.id = p.scientist_id
  join public.scientist_profile_translations t on t.scientist_profile_id = s.id and t.locale = p_locale
  left join public.publication_translations pt on pt.publication_id = p.id and pt.locale = p_locale
  left join public.media_assets m on m.id = p.file_media_id and m.deleted_at is null and m.status = 'ready'
  where p.status = 'published' and p.deleted_at is null and p.published_at <= now()
    and s.status = 'verified' and s.is_public and s.deleted_at is null
    and (p_id is null or p.id = p_id) and (p_scientist is null or p.scientist_id = p_scientist or exists(
      select 1 from public.publication_coauthors a join public.scientist_profiles cs on cs.id = a.scientist_id
      join public.scientist_profile_translations st on st.scientist_profile_id = cs.id and st.locale = p_locale
      where a.publication_id = p.id and a.scientist_id = p_scientist and cs.status = 'verified' and cs.is_public and cs.deleted_at is null))
  order by p.year desc, p.title, p.id limit 100
$$;
revoke all on function public.list_public_publications(text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_public_publications(text,uuid,uuid) to anon,authenticated;

drop function if exists public.list_public_work_publications(text,uuid);
create function public.list_public_work_publications(p_locale text, p_work uuid)
returns table(id uuid, scientist_id uuid, title text, year integer, journal text, doi text, url text,
  publication_type text, scientist_name text, scientist_href text, summary text, slug text, file_media_id uuid, file_name text, authors jsonb, works jsonb)
language sql stable security definer set search_path='' as $$
  select p.* from public.publication_works l join public.science_works w on w.id = l.work_id
  join public.science_work_translations t on t.work_id = w.id and t.locale = p_locale
  cross join lateral public.list_public_publications(p_locale, l.publication_id, null) p
  where w.id = p_work and w.status = 'published' and w.deleted_at is null and w.published_at <= now()
  order by p.year desc, p.title, p.id limit 100
$$;
revoke all on function public.list_public_work_publications(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_public_work_publications(text,uuid) to anon,authenticated;

