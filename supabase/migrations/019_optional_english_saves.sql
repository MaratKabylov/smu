-- Persist the optional English row in the same transaction as each existing
-- atomic save RPC. The renamed implementations continue to own all entity,
-- permission, locking, audit and required RU/KK validation.

alter function public.save_article(uuid, jsonb) rename to save_article_required_locales;
alter function public.save_scientist(uuid, jsonb) rename to save_scientist_required_locales;
alter function public.save_science_work(uuid, public.science_work_kind, uuid, jsonb) rename to save_science_work_required_locales;
alter function public.save_mentorship_offer(uuid, uuid, jsonb) rename to save_mentorship_offer_required_locales;
alter function public.save_research_program(uuid, uuid, jsonb) rename to save_research_program_required_locales;
alter function public.save_event(uuid, uuid, jsonb) rename to save_event_required_locales;

create function public.save_article(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_t jsonb := p_input->'en'; v_doc jsonb; v_body text; v_old_slug text; v_published boolean; v_image jsonb;
begin
  v_id := public.save_article_required_locales(p_id, p_input);
  if v_t is null then
    delete from public.article_translations where article_id = v_id and locale = 'en';
  else
    if jsonb_typeof(v_t) <> 'object' then raise exception 'invalid_input'; end if;
    v_doc := coalesce(nullif(v_t->'contentJson', 'null'::jsonb), public.smu_plain_text_document(v_t->>'body'));
    if octet_length(v_doc::text) > 1000000 then raise exception 'invalid_input'; end if;
    v_body := public.validate_smu_rich_text(v_doc);
    if length(btrim(v_t->>'title')) not between 3 and 240 or length(btrim(v_t->>'excerpt')) not between 10 and 1000
      or length(btrim(v_body)) not between 20 and 200000 or length(coalesce(v_t->>'seoTitle', '')) > 70
      or length(coalesce(v_t->>'seoDescription', '')) > 170 or coalesce(v_t->>'slug', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      then raise exception 'invalid_input'; end if;
    for v_image in select value from jsonb_path_query(v_doc, '$.** ? (@.type == "image")') images(value) loop
      if not exists(select 1 from public.media_assets where id = (v_image->'attrs'->>'mediaId')::uuid and status = 'ready'
        and deleted_at is null and storage_bucket = 'article-media' and mime_type like 'image/%') then raise exception 'invalid_reference'; end if;
    end loop;
    select t.slug, a.first_published_at is not null into v_old_slug, v_published
      from public.articles a left join public.article_translations t on t.article_id = a.id and t.locale = 'en' where a.id = v_id;
    perform public.preserve_smu_slug('article', v_id, 'en', v_old_slug, v_t->>'slug', v_published);
    insert into public.article_translations(article_id, locale, title, slug, excerpt, body, content_json, seo_title, seo_description)
      values(v_id, 'en', btrim(v_t->>'title'), v_t->>'slug', btrim(v_t->>'excerpt'), v_body, v_doc,
        nullif(v_t->>'seoTitle', ''), nullif(v_t->>'seoDescription', ''))
      on conflict(article_id, locale) do update set title=excluded.title, slug=excluded.slug, excerpt=excluded.excerpt,
        body=excluded.body, content_json=excluded.content_json, seo_title=excluded.seo_title, seo_description=excluded.seo_description;
  end if;
  delete from public.media_usages where entity_type = 'article' and entity_id = v_id and field_name = 'content_en';
  insert into public.media_usages(media_asset_id, entity_type, entity_id, field_name)
    select distinct (image.value->'attrs'->>'mediaId')::uuid, 'article', v_id, 'content_en'
    from public.article_translations t cross join lateral jsonb_path_query(t.content_json, '$.** ? (@.type == "image")') image(value)
    where t.article_id = v_id and t.locale = 'en';
  return v_id;
end; $$;

create function public.save_scientist(p_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_t jsonb := p_input->'en'; v_old_slug text; v_verified boolean;
begin
  v_id := public.save_scientist_required_locales(p_id, p_input);
  if v_t is null then delete from public.scientist_profile_translations where scientist_profile_id=v_id and locale='en';
  else
    if jsonb_typeof(v_t) <> 'object' or length(btrim(v_t->>'fullName')) not between 3 and 180
      or length(btrim(v_t->>'position')) not between 2 and 180 or length(btrim(v_t->>'shortBio')) not between 20 and 600
      or length(btrim(v_t->>'biography')) not between 40 and 20000 or length(coalesce(v_t->>'academicDegree','')) > 180
      or coalesce(v_t->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid_input'; end if;
    select t.slug, s.first_verified_at is not null into v_old_slug, v_verified from public.scientist_profiles s
      left join public.scientist_profile_translations t on t.scientist_profile_id=s.id and t.locale='en' where s.id=v_id;
    perform public.preserve_smu_slug('scientist', v_id, 'en', v_old_slug, v_t->>'slug', v_verified);
    insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,academic_degree,short_bio,biography)
      values(v_id,'en',btrim(v_t->>'fullName'),v_t->>'slug',btrim(v_t->>'position'),nullif(v_t->>'academicDegree',''),btrim(v_t->>'shortBio'),btrim(v_t->>'biography'))
      on conflict(scientist_profile_id,locale) do update set full_name=excluded.full_name,slug=excluded.slug,position=excluded.position,
        academic_degree=excluded.academic_degree,short_bio=excluded.short_bio,biography=excluded.biography;
  end if;
  return v_id;
end; $$;

create function public.save_science_work(p_id uuid,p_kind public.science_work_kind,p_actor uuid,p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_t jsonb:=p_input->'en';
begin
  v_id:=public.save_science_work_required_locales(p_id,p_kind,p_actor,p_input);
  if v_t is null then delete from public.science_work_translations where work_id=v_id and locale='en';
  else
    if jsonb_typeof(v_t)<>'object' or length(btrim(v_t->>'title')) not between 3 and 240
      or length(btrim(v_t->>'summary')) not between 20 and 800 or length(btrim(v_t->>'description')) not between 40 and 30000
      or length(coalesce(v_t->>'results',''))>20000 or coalesce(v_t->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid_input'; end if;
    insert into public.science_work_translations(work_id,locale,title,slug,summary,description,results)
      values(v_id,'en',btrim(v_t->>'title'),v_t->>'slug',btrim(v_t->>'summary'),btrim(v_t->>'description'),btrim(v_t->>'results'))
      on conflict(work_id,locale) do update set title=excluded.title,slug=excluded.slug,summary=excluded.summary,description=excluded.description,results=excluded.results;
  end if; return v_id;
end; $$;

create function public.save_mentorship_offer(p_id uuid,p_actor uuid,p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_t jsonb:=p_input->'en';
begin
  v_id:=public.save_mentorship_offer_required_locales(p_id,p_actor,p_input);
  if v_t is null then delete from public.mentorship_offer_translations where offer_id=v_id and locale='en';
  else
    if jsonb_typeof(v_t)<>'object' or length(btrim(v_t->>'title')) not between 3 and 240
      or length(btrim(v_t->>'summary')) not between 20 and 800 or length(btrim(v_t->>'description')) not between 40 and 20000
      or coalesce(v_t->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid_input'; end if;
    insert into public.mentorship_offer_translations(offer_id,locale,title,slug,summary,description)
      values(v_id,'en',btrim(v_t->>'title'),v_t->>'slug',btrim(v_t->>'summary'),btrim(v_t->>'description'))
      on conflict(offer_id,locale) do update set title=excluded.title,slug=excluded.slug,summary=excluded.summary,description=excluded.description;
  end if; return v_id;
end; $$;

create function public.save_research_program(p_id uuid,p_actor uuid,p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_t jsonb:=p_input->'en';
begin
  v_id:=public.save_research_program_required_locales(p_id,p_actor,p_input);
  if v_t is null then delete from public.research_program_translations where program_id=v_id and locale='en';
  else
    if jsonb_typeof(v_t)<>'object' or length(btrim(v_t->>'title')) not between 3 and 240
      or length(btrim(v_t->>'summary')) not between 20 and 800 or length(btrim(v_t->>'description')) not between 40 and 20000
      or length(btrim(v_t->>'curriculum')) not between 20 and 10000 or length(btrim(v_t->>'eligibility')) not between 20 and 5000
      or length(btrim(v_t->>'outcomes')) not between 20 and 10000 or coalesce(v_t->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid_input'; end if;
    insert into public.research_program_translations(program_id,locale,title,slug,summary,description,curriculum,eligibility,outcomes)
      values(v_id,'en',btrim(v_t->>'title'),v_t->>'slug',btrim(v_t->>'summary'),btrim(v_t->>'description'),btrim(v_t->>'curriculum'),btrim(v_t->>'eligibility'),btrim(v_t->>'outcomes'))
      on conflict(program_id,locale) do update set title=excluded.title,slug=excluded.slug,summary=excluded.summary,description=excluded.description,
        curriculum=excluded.curriculum,eligibility=excluded.eligibility,outcomes=excluded.outcomes;
  end if; return v_id;
end; $$;

create function public.save_event(p_id uuid,p_actor uuid,p_input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_t jsonb:=p_input->'en';
begin
  v_id:=public.save_event_required_locales(p_id,p_actor,p_input);
  if v_t is null then delete from public.event_translations where event_id=v_id and locale='en';
  else
    if jsonb_typeof(v_t)<>'object' or length(btrim(v_t->>'title')) not between 3 and 240
      or length(btrim(v_t->>'summary')) not between 20 and 800 or length(btrim(v_t->>'description')) not between 40 and 30000
      or length(btrim(v_t->>'organizer')) not between 2 and 240 or length(coalesce(v_t->>'location',''))>500
      or coalesce(v_t->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid_input'; end if;
    if (p_input->>'format') <> 'online' and length(btrim(v_t->>'location')) < 3 then raise exception 'invalid_location'; end if;
    insert into public.event_translations(event_id,locale,title,slug,summary,description,organizer,location)
      values(v_id,'en',btrim(v_t->>'title'),v_t->>'slug',btrim(v_t->>'summary'),btrim(v_t->>'description'),btrim(v_t->>'organizer'),btrim(v_t->>'location'))
      on conflict(event_id,locale) do update set title=excluded.title,slug=excluded.slug,summary=excluded.summary,description=excluded.description,
        organizer=excluded.organizer,location=excluded.location;
  end if; return v_id;
end; $$;

revoke all on function public.save_article_required_locales(uuid,jsonb), public.save_scientist_required_locales(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.save_science_work_required_locales(uuid,public.science_work_kind,uuid,jsonb), public.save_mentorship_offer_required_locales(uuid,uuid,jsonb),
  public.save_research_program_required_locales(uuid,uuid,jsonb), public.save_event_required_locales(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_science_work_required_locales(uuid,public.science_work_kind,uuid,jsonb), public.save_mentorship_offer_required_locales(uuid,uuid,jsonb),
  public.save_research_program_required_locales(uuid,uuid,jsonb), public.save_event_required_locales(uuid,uuid,jsonb) to service_role;
revoke all on function public.save_article(uuid,jsonb), public.save_scientist(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_article(uuid,jsonb), public.save_scientist(uuid,jsonb) to authenticated;
revoke all on function public.save_science_work(uuid,public.science_work_kind,uuid,jsonb), public.save_mentorship_offer(uuid,uuid,jsonb),
  public.save_research_program(uuid,uuid,jsonb), public.save_event(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_science_work(uuid,public.science_work_kind,uuid,jsonb), public.save_mentorship_offer(uuid,uuid,jsonb),
  public.save_research_program(uuid,uuid,jsonb), public.save_event(uuid,uuid,jsonb) to service_role;

-- Older workflow functions used "exactly two translations" as shorthand for
-- "the required RU/KK pair exists". Locales are constrained to RU/KK/EN and
-- every save RPC still writes RU and KK, so accepting a third row is safe.
do $$
declare v_signature text; v_oid regprocedure; v_definition text;
begin
  foreach v_signature in array array[
    'public.save_article_required_locales(uuid,jsonb)',
    'public.change_article_state(uuid,public.article_status,boolean,integer)',
    'public.capture_article_revision(uuid,text)',
    'public.change_scientist_state(uuid,public.scientist_profile_status,boolean)',
    'public.change_science_work_state(uuid,public.science_work_kind,uuid,public.science_work_status,boolean)',
    'public.change_mentorship_offer_state(uuid,uuid,public.mentorship_offer_status,boolean)',
    'public.change_research_program_state(uuid,uuid,public.research_program_status,boolean)',
    'public.change_event_state(uuid,uuid,public.event_status,boolean)',
    'public.assert_restorable_article_links(uuid)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then raise exception 'required function is missing: %', v_signature; end if;
    v_definition := pg_get_functiondef(v_oid::oid);
    v_definition := regexp_replace(v_definition, '<> 2(::bigint)?', '< 2', 'g');
    execute v_definition;
  end loop;
end;
$$;
