-- Account reads are separate from public projections and administrative RLS.
-- No caller-supplied identity, email, role or ownership is accepted.
alter table public.mentorship_applications add column user_id uuid references public.profiles(id) on delete restrict;
alter table public.research_program_applications add column user_id uuid references public.profiles(id) on delete restrict;
create index mentorship_applications_user_idx on public.mentorship_applications(user_id, updated_at desc) where deleted_at is null;
create index research_program_applications_user_idx on public.research_program_applications(user_id, updated_at desc) where deleted_at is null;
create index science_works_creator_idx on public.science_works(created_by, updated_at desc) where deleted_at is null;

create function public.smu_account_user_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null or not exists (
    select 1 from auth.users u where u.id=v_id and nullif(btrim(u.email),'') is not null
      and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null
      and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false
  ) then raise exception 'forbidden'; end if;
  return v_id;
end $$;
revoke all on function public.smu_account_user_id() from public,anon,authenticated,service_role;

create function public.claim_account_applications() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.smu_account_user_id(); v_email text; v_total integer := 0; v_row record;
begin
  -- Keep the verified address stable through this transaction. Confirmation is
  -- read from Auth, never from user-editable metadata or the JWT email claim.
  select lower(btrim(u.email)) into v_email from auth.users u where u.id=v_actor for share;
  if not exists(select 1 from auth.users u where u.id=v_actor
    and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null
    and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false)
    then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email,0));
  for v_row in
    update public.mentorship_applications set user_id=v_actor
      where user_id is null and email=v_email and deleted_at is null returning id
  loop
    insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data)
      values(v_actor,'mentorship_application',v_row.id,'application.account.claim',jsonb_build_object('linked',true));
    v_total:=v_total+1;
  end loop;
  for v_row in
    update public.research_program_applications set user_id=v_actor
      where user_id is null and email=v_email and deleted_at is null returning id
  loop
    insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data)
      values(v_actor,'research_program_application',v_row.id,'application.account.claim',jsonb_build_object('linked',true));
    v_total:=v_total+1;
  end loop;
  return v_total;
end $$;
revoke all on function public.claim_account_applications() from public,anon,authenticated,service_role;
grant execute on function public.claim_account_applications() to authenticated;

create function public.list_account_records(p_locale text,p_section text,p_page integer default 1,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := public.smu_account_user_id(); v_result jsonb;
begin
  if p_locale is null or p_locale not in ('ru','kk','en') or p_section is null
    or p_section not in ('scientist','articles','projects','applications')
    or p_page is null or p_page not between 1 and 100000 then raise exception 'invalid_input'; end if;
  with records as (
    select s.id,'scientist'::text kind,t.full_name title,s.verification_status::text status,s.updated_at,
      t.locale,t.short_bio summary,case when p_id is not null then t.biography else null end body,
      null::jsonb content,'owner'::text relationship
    from public.scientist_profiles s
    left join lateral (select st.* from public.scientist_profile_translations st where st.scientist_profile_id=s.id
      order by (st.locale=p_locale) desc,(st.locale='ru') desc,st.locale limit 1) t on true
    where p_section='scientist' and s.user_id=v_actor and s.deleted_at is null and (p_id is null or s.id=p_id)
    union all
    select a.id,'article',t.title,a.status::text,a.updated_at,t.locale,t.excerpt,
      case when p_id is not null then t.body else null end,
      case when p_id is not null then t.content_json else null end,'owner'
    from public.articles a
    left join lateral (select at.* from public.article_translations at where at.article_id=a.id
      order by (at.locale=p_locale) desc,(at.locale='ru') desc,at.locale limit 1) t on true
    where p_section='articles' and a.author_id=v_actor and a.deleted_at is null and (p_id is null or a.id=p_id)
    union all
    select w.id,w.kind::text,t.title,w.status::text,w.updated_at,t.locale,t.summary,
      case when p_id is not null then t.description || case when t.results<>'' then E'\n\n' || t.results else '' end else null end,
      null::jsonb,case when w.created_by=v_actor then 'owner' else 'member' end
    from public.science_works w
    left join lateral (select wt.* from public.science_work_translations wt where wt.work_id=w.id
      order by (wt.locale=p_locale) desc,(wt.locale='ru') desc,wt.locale limit 1) t on true
    where p_section='projects' and w.deleted_at is null and (p_id is null or w.id=p_id)
      and (w.created_by=v_actor or exists(select 1 from public.science_work_members m join public.scientist_profiles s on s.id=m.scientist_id
        where m.work_id=w.id and s.user_id=v_actor and s.deleted_at is null))
    union all
    select a.id,'mentorship_application',t.title,a.status::text,a.updated_at,t.locale,
      null::text,case when p_id is not null then a.motivation else null end,null::jsonb,'applicant'
    from public.mentorship_applications a join public.mentorship_offers o on o.id=a.offer_id and o.deleted_at is null
    left join lateral (select ot.* from public.mentorship_offer_translations ot where ot.offer_id=o.id
      order by (ot.locale=p_locale) desc,(ot.locale='ru') desc,ot.locale limit 1) t on true
    where p_section='applications' and a.user_id=v_actor and a.deleted_at is null and (p_id is null or a.id=p_id)
    union all
    select a.id,'program_application',t.title,a.status::text,a.updated_at,t.locale,
      null::text,case when p_id is not null then a.motivation else null end,null::jsonb,'applicant'
    from public.research_program_applications a join public.research_programs r on r.id=a.program_id and r.deleted_at is null
    left join lateral (select rt.* from public.research_program_translations rt where rt.program_id=r.id
      order by (rt.locale=p_locale) desc,(rt.locale='ru') desc,rt.locale limit 1) t on true
    where p_section='applications' and a.user_id=v_actor and a.deleted_at is null and (p_id is null or a.id=p_id)
  ), page as (select * from records order by updated_at desc,id,kind limit 20 offset ((p_page-1)*20))
  select jsonb_build_object('total',(select count(*) from records),'page',p_page,'pageSize',20,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',coalesce(title,''),'status',status,
      'updatedAt',updated_at,'locale',locale,'summary',summary,'body',body,'content',content,'relationship',relationship)
      order by updated_at desc,id,kind) from page),'[]'::jsonb)) into v_result;
  return v_result;
end $$;
revoke all on function public.list_account_records(text,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_account_records(text,text,integer,uuid) to authenticated;
