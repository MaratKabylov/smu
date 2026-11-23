-- Migration 045: Public Research Outputs Catalog Function

create or replace function public.list_all_public_research_outputs(
  p_locale text,
  p_id uuid default null,
  p_work_id uuid default null
) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(item order by published_at desc, id),'[]'::jsonb) from (
    select distinct on (o.id)
      o.id,
      o.published_at,
      jsonb_build_object(
        'id', o.id,
        'kind', o.kind,
        'version', o.version,
        'versionLabel', v.snapshot->>'versionLabel',
        'license', v.snapshot->>'license',
        'title', v.snapshot->p_locale->>'title',
        'description', v.snapshot->p_locale->>'description',
        'externalUrl', v.snapshot->>'externalUrl',
        'publishedAt', o.published_at,
        'updatedAt', o.updated_at,
        'works', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sw.id,
            'kind', sw.kind,
            'title', coalesce(swt.title, sw.id::text)
          ) order by sw.updated_at desc)
          from public.research_output_works rw
          join public.science_works sw on sw.id = rw.work_id
          left join public.science_work_translations swt on swt.work_id = sw.id and swt.locale = p_locale
          where rw.output_id = o.id and sw.status = 'published' and sw.deleted_at is null
        ), '[]'::jsonb),
        'files', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', u.id,
            'name', u.file_name,
            'size', u.file_size,
            'mimeType', u.mime_type
          ) order by u.file_name, u.id)
          from public.research_output_files f
          join public.research_output_uploads u on u.id = f.upload_id
          where f.output_id = o.id and f.version = o.version and f.is_public and u.ready
        ), '[]'::jsonb)
      ) item
    from public.research_outputs o
    join public.research_output_versions v on v.output_id = o.id and v.version = o.version
    join public.research_output_works r on r.output_id = o.id
    join public.science_works w on w.id = r.work_id
    where (p_id is null or o.id = p_id)
      and (p_work_id is null or r.work_id = p_work_id)
      and p_locale in ('ru', 'kk', 'en')
      and v.snapshot ? p_locale
      and o.status = 'published'
      and o.published_at <= now()
      and w.status = 'published'
      and w.published_at <= now()
      and w.deleted_at is null
    order by o.id, o.published_at desc
  ) visible;
$$;

revoke all on function public.list_all_public_research_outputs(text,uuid,uuid) from public,service_role;
grant execute on function public.list_all_public_research_outputs(text,uuid,uuid) to anon,authenticated;
