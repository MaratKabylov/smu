-- Source material is private until its owner authorizes the exact saved version.
-- Fail visibly on a pre-existing route conflict; never silently rename content.
do $$ begin
  if exists(select 1 from public.mentorship_offer_translations where slug='legacy') then
    raise exception 'reserved_legacy_slug_conflict: rename the mentorship offer slug before applying 034';
  end if;
end $$;
alter table public.mentorship_offer_translations add constraint mentorship_slug_reserved_legacy check(slug<>'legacy');

create table public.scientific_legacy (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null check(kind in ('topic','archive','unpublished_data','dataset','methodology','collection','unfinished_research','scientific_school','successor_topic')),
  status text not null check(status in ('draft','published','archived')),
  translations jsonb not null,
  source_text text not null default '',
  source_url text not null default '',
  version integer not null default 1 check(version > 0),
  consent_version integer,
  consent_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((consent_version is null)=(consent_at is null)),
  check (consent_version is null or consent_version=version)
);
create index scientific_legacy_owner_idx on public.scientific_legacy(owner_id,updated_at desc,id);
create index scientific_legacy_public_idx on public.scientific_legacy(updated_at desc,id) where status='published';
alter table public.scientific_legacy enable row level security;
-- All projections, including the owner's, go through checked RPCs.
revoke all on public.scientific_legacy from public,anon,authenticated,service_role;

create function public.save_scientific_legacy(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_id uuid; v_old public.scientific_legacy%rowtype;
  v_kind text:=p_input->>'kind'; v_status text:=p_input->>'status'; v_translations jsonb:=p_input->'translations';
  v_text text:=p_input->>'sourceText'; v_url text:=p_input->>'sourceUrl'; v_t jsonb;
begin
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>500000
    or (p_input->'rightsConfirmed') is distinct from 'true'::jsonb
    or v_kind is null or v_kind not in ('topic','archive','unpublished_data','dataset','methodology','collection','unfinished_research','scientific_school','successor_topic')
    or v_status is null or v_status not in ('draft','published','archived')
    or jsonb_typeof(p_input->'sourceText') is distinct from 'string' or length(v_text)>100000
    or jsonb_typeof(p_input->'sourceUrl') is distinct from 'string' or length(v_url)>2000
    or (v_url<>'' and v_url !~ '^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$')
    or jsonb_typeof(v_translations) is distinct from 'array' then raise exception 'invalid_input'; end if;
  if jsonb_array_length(v_translations) not between 2 and 3 then raise exception 'invalid_input'; end if;
  for v_t in select value from jsonb_array_elements(v_translations) loop
    if jsonb_typeof(v_t) is distinct from 'object' or v_t->>'locale' is null or v_t->>'locale' not in ('ru','kk','en')
      or jsonb_typeof(v_t->'title') is distinct from 'string' or length(btrim(v_t->>'title')) not between 3 and 200
      or jsonb_typeof(v_t->'description') is distinct from 'string' or length(btrim(v_t->>'description')) not between 20 and 20000
      then raise exception 'invalid_input'; end if;
  end loop;
  if (select count(distinct value->>'locale') from jsonb_array_elements(v_translations))<>jsonb_array_length(v_translations)
    or not v_translations @> '[{"locale":"ru"},{"locale":"kk"}]'::jsonb then raise exception 'invalid_input'; end if;
  -- Rebuild the JSON so arbitrary caller properties never become public.
  select jsonb_agg(jsonb_build_object('locale',value->>'locale','title',btrim(value->>'title'),'description',btrim(value->>'description')) order by value->>'locale') into v_translations
    from jsonb_array_elements(v_translations);
  if p_input->>'id' is null then
    if p_input->>'version' is not null then raise exception 'invalid_input'; end if;
    insert into public.scientific_legacy(owner_id,kind,status,translations,source_text,source_url,published_at)
      values(v_actor,v_kind,v_status,v_translations,v_text,v_url,case when v_status='published' then now() end) returning id into v_id;
  else
    v_id:=(p_input->>'id')::uuid;
    select * into v_old from public.scientific_legacy where id=v_id and owner_id=v_actor for update;
    if not found then raise exception 'not_found'; end if;
    if (p_input->>'version')::integer is distinct from v_old.version then raise exception 'stale_version'; end if;
    update public.scientific_legacy set kind=v_kind,status=v_status,translations=v_translations,source_text=v_text,source_url=v_url,
      version=version+1,consent_version=null,consent_at=null,updated_at=now(),
      published_at=case when v_status='published' then coalesce(published_at,now()) else published_at end where id=v_id;
  end if;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data)
    select v_actor,'scientific_legacy',id,'save',jsonb_build_object('version',version,'status',status,'rightsConfirmed',true,'sourceConsent',false)
      from public.scientific_legacy where id=v_id;
  return v_id;
end $$;
revoke all on function public.save_scientific_legacy(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_scientific_legacy(jsonb) to authenticated;

create function public.set_scientific_legacy_consent(p_id uuid,p_version integer,p_granted boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_old public.scientific_legacy%rowtype;
begin
  if p_granted is null then raise exception 'invalid_input'; end if;
  select * into v_old from public.scientific_legacy where id=p_id and owner_id=v_actor for update;
  if not found then raise exception 'not_found'; end if;
  if p_version is distinct from v_old.version then raise exception 'stale_version'; end if;
  if p_granted and (v_old.status<>'published' or (v_old.source_text='' and v_old.source_url='')) then raise exception 'invalid_input'; end if;
  if p_granted=(v_old.consent_version is not null) then return; end if;
  -- Advance the revision on grant/revoke as well: a previously confirmed form
  -- cannot re-grant permission after a later revocation.
  update public.scientific_legacy set consent_version=case when p_granted then version+1 end,
    consent_at=case when p_granted then now() end,version=version+1,updated_at=now() where id=p_id;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data)
    values(v_actor,'scientific_legacy',p_id,'source_consent',jsonb_build_object('version',p_version+1,'granted',p_granted,'policy','legacy-source-v1'));
end $$;
revoke all on function public.set_scientific_legacy_consent(uuid,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function public.set_scientific_legacy_consent(uuid,integer,boolean) to authenticated;

create function public.list_scientific_legacy(p_locale text,p_page integer default 1,p_id uuid default null,p_own boolean default false,p_kind text default 'all') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid; v_result jsonb;
begin
  if p_locale is null or p_locale not in ('ru','kk','en') or p_page is null or p_page not between 1 and 100000 or p_own is null
    or p_kind is null or p_kind not in ('all','topic','archive','unpublished_data','dataset','methodology','collection','unfinished_research','scientific_school','successor_topic') then raise exception 'invalid_input'; end if;
  if p_own then v_actor:=public.smu_account_user_id(); end if;
  with visible as (
    select l.*,t.value as translation from public.scientific_legacy l
    left join lateral (select value from jsonb_array_elements(l.translations) where value->>'locale'=p_locale) t on true
    where (p_id is null or l.id=p_id) and (p_kind='all' or l.kind=p_kind)
      and case when p_own then l.owner_id=v_actor else l.status='published' and l.published_at<=now() and t.value is not null end
  ), page as (select * from visible order by updated_at desc,id limit 20 offset (p_page-1)*20)
  select jsonb_build_object('total',(select count(*) from visible),'page',p_page,'pageSize',20,'items',coalesce((
    select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'status',status,'translations',case when p_own then translations else jsonb_build_array(translation) end,
      'sourceText',case when p_id is not null and (p_own or consent_version=version) then source_text else '' end,
      'sourceUrl',case when p_id is not null and (p_own or consent_version=version) then source_url else '' end)
      || case when p_own then jsonb_build_object('version',version,'sourceConsent',coalesce(consent_version=version,false),'consentAt',consent_at) else '{}'::jsonb end
      order by updated_at desc,id) from page),'[]'::jsonb)) into v_result;
  return v_result;
end $$;
revoke all on function public.list_scientific_legacy(text,integer,uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.list_scientific_legacy(text,integer,uuid,boolean,text) to anon,authenticated;
