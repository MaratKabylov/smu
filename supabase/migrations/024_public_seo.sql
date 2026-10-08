-- Public indexing projection. Reuse the search visibility rules for every
-- language and every module; permissions never widen an indexing response.
create function public.seo_public_page(p_page integer default 1, p_page_size integer default 1000,
  p_section text default '', p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_page is null or p_page not between 1 and 1000000 or p_page_size is null or p_page_size not between 1 and 1000
    or p_section is null or p_section not in ('', 'journal', 'scientists', 'research', 'projects', 'publications', 'mentorship', 'research-program', 'events')
    then raise exception 'invalid_input'; end if;
  with visible as (
    select e.id, e.section, max(e.updated_at) updated_at,
      jsonb_agg(jsonb_build_object('locale', e.locale, 'href', e.href) order by e.locale) translations
    from public.search_entries e
    where e.is_public and e.section in ('journal', 'scientists', 'research', 'projects', 'publications', 'mentorship', 'research-program', 'events')
      and (p_section = '' or e.section = p_section) and (p_id is null or e.id = p_id)
    group by e.section, e.id
  ), page as (
    select * from visible order by section, id
    limit p_page_size offset (p_page::bigint - 1) * p_page_size
  ) select jsonb_build_object('total', (select count(*) from visible),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'section', section,
      'updatedAt', updated_at, 'translations', translations) order by section, id) from page), '[]'::jsonb)) into v_result;
  return v_result;
end $$;

create function public.seo_public_feed(p_locale text, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_locale is null or p_locale not in ('ru', 'kk', 'en') or p_limit is null or p_limit not between 1 and 100
    then raise exception 'invalid_input'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'summary', summary,
    'href', href, 'publishedAt', sort_at) order by sort_at desc, id) from (
      select id, title, summary, href, sort_at from public.search_entries
      where is_public and section = 'journal' and locale = p_locale
      order by sort_at desc, id limit p_limit
    ) latest), '[]'::jsonb);
end $$;

revoke all on function public.seo_public_page(integer, integer, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.seo_public_feed(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.seo_public_page(integer, integer, text, uuid) to anon, authenticated;
grant execute on function public.seo_public_feed(text, integer) to anon, authenticated;
