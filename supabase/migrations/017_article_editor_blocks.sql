-- Extend the bounded TipTap vocabulary without rewriting stored content or revisions.
create or replace function public.validate_smu_rich_text(p_node jsonb, p_parent text default null, p_depth integer default 0)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_type text := p_node->>'type'; v_child jsonb; v_mark jsonb; v_attrs jsonb := coalesce(p_node->'attrs', '{}'::jsonb);
  v_allowed text[]; v_result text := ''; v_first boolean := true; v_separator text := ''; v_width integer;
begin
  if p_depth > 20 or jsonb_typeof(p_node) is distinct from 'object' or v_type is null
    or exists (select 1 from jsonb_object_keys(p_node) k where k not in ('type', 'text', 'content', 'attrs', 'marks'))
    then raise exception 'invalid_input'; end if;
  if p_parent is null and (length(p_node::text) > 1000000 or (
    with recursive nodes(value) as (
      select p_node union all
      select child.value from nodes n cross join lateral jsonb_array_elements(
        case when jsonb_typeof(n.value->'content') = 'array' then n.value->'content' else '[]'::jsonb end) child(value)
    ) select count(*) > 10000 from nodes
  )) then raise exception 'invalid_input'; end if;
  v_allowed := case
    when p_parent is null then array['doc']
    when p_parent in ('doc', 'blockquote', 'listItem', 'tableCell', 'tableHeader', 'callout') then array['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'codeBlock', 'horizontalRule', 'image', 'table', 'video', 'callout', 'bibliography']
    when p_parent in ('bulletList', 'orderedList') then array['listItem']
    when p_parent = 'table' then array['tableRow']
    when p_parent = 'tableRow' then array['tableCell', 'tableHeader']
    when p_parent = 'bibliography' then array['bibliographyEntry']
    when p_parent = 'codeBlock' then array['text']
    else array['text', 'hardBreak', 'citation'] end;
  if not (v_type = any(v_allowed)) then raise exception 'invalid_input'; end if;
  if jsonb_typeof(v_attrs) is distinct from 'object'
    or exists (select 1 from jsonb_each(v_attrs) a where jsonb_typeof(a.value) not in ('string', 'number', 'null'))
    then raise exception 'invalid_input'; end if;
  if p_node ? 'content' and (jsonb_typeof(p_node->'content') is distinct from 'array' or jsonb_array_length(p_node->'content') > 10000)
    then raise exception 'invalid_input'; end if;
  if v_type = 'text' then
    if jsonb_typeof(p_node->'text') is distinct from 'string' or length(p_node->>'text') not between 1 and 200000
      then raise exception 'invalid_input'; end if;
    v_result := p_node->>'text';
  elsif p_node ? 'text' then raise exception 'invalid_input'; end if;
  if v_type in ('text', 'hardBreak', 'horizontalRule', 'image', 'video', 'citation', 'bibliographyEntry') and p_node ? 'content'
    then raise exception 'invalid_input'; end if;
  if v_type = 'heading' and coalesce(v_attrs->>'level', '') not in ('2', '3', '4') then raise exception 'invalid_input'; end if;
  if v_type = 'image' and (coalesce(v_attrs->>'mediaId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (nullif(v_attrs->>'src', '') is not null and (v_attrs->>'src' !~* '^https?://' or v_attrs->>'src' ~ '[[:space:][:cntrl:]]')))
    then raise exception 'invalid_input'; end if;
  if v_type = 'video' and (
    coalesce(v_attrs->>'src', '') !~ '^https://(www\.youtube-nocookie\.com/embed/[A-Za-z0-9_-]{11}|player\.vimeo\.com/video/[1-9][0-9]{0,11})$'
    or jsonb_typeof(v_attrs->'title') is distinct from 'string' or length(btrim(coalesce(v_attrs->>'title', ''))) = 0 or length(v_attrs->>'title') > 240
    or (v_attrs->'caption' is not null and v_attrs->'caption' <> 'null'::jsonb and (jsonb_typeof(v_attrs->'caption') <> 'string' or length(v_attrs->>'caption') > 1000))
  ) then raise exception 'invalid_input'; end if;
  if v_type in ('citation', 'bibliographyEntry') then
    if jsonb_typeof(v_attrs->'label') is distinct from 'string' or length(btrim(coalesce(v_attrs->>'label', ''))) = 0 or length(v_attrs->>'label') > 1000
      or (nullif(v_attrs->>'doi', '') is not null and (jsonb_typeof(v_attrs->'doi') <> 'string' or length(v_attrs->>'doi') > 200 or v_attrs->>'doi' !~* '^10\.[0-9]{4,9}/[a-z0-9._;()/:-]+$'))
      or (nullif(v_attrs->>'url', '') is not null and (jsonb_typeof(v_attrs->'url') <> 'string' or length(v_attrs->>'url') > 2000
        or v_attrs->>'url' !~* '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#].*)?$' or v_attrs->>'url' ~ '[[:space:][:cntrl:]]'))
      or (nullif(v_attrs->>'doi', '') is null and nullif(v_attrs->>'url', '') is null)
      then raise exception 'invalid_input'; end if;
    v_result := v_attrs->>'label' || case when nullif(v_attrs->>'doi', '') is not null then ' DOI: ' || (v_attrs->>'doi') else ' ' || (v_attrs->>'url') end;
  end if;
  if v_type = 'bibliography' and (
    coalesce(jsonb_array_length(p_node->'content'), 0) not between 1 and 100
    or (v_attrs->'title' is not null and v_attrs->'title' <> 'null'::jsonb and (jsonb_typeof(v_attrs->'title') <> 'string' or length(v_attrs->>'title') > 240))
  ) then raise exception 'invalid_input'; end if;
  if v_type = 'callout' and (coalesce(jsonb_array_length(p_node->'content'), 0) = 0 or coalesce(v_attrs->>'kind', '') not in ('info', 'warning', 'success'))
    then raise exception 'invalid_input'; end if;
  if v_type = 'table' then
    v_width := coalesce(jsonb_array_length(p_node->'content'->0->'content'), 0);
    if coalesce(jsonb_array_length(p_node->'content'), 0) not between 1 and 50 or v_width not between 1 and 20
      or exists (select 1 from jsonb_array_elements(p_node->'content') r where jsonb_typeof(r->'content') is distinct from 'array' or jsonb_array_length(r->'content') <> v_width)
      then raise exception 'invalid_input'; end if;
  end if;
  if v_type in ('tableCell', 'tableHeader') and (
    coalesce(jsonb_array_length(p_node->'content'), 0) = 0
    or (v_attrs ? 'colspan' and v_attrs->'colspan' not in ('null'::jsonb, '1'::jsonb))
    or (v_attrs ? 'rowspan' and v_attrs->'rowspan' not in ('null'::jsonb, '1'::jsonb))
    or (v_attrs ? 'colwidth' and v_attrs->'colwidth' <> 'null'::jsonb)
  ) then raise exception 'invalid_input'; end if;
  if p_node ? 'marks' then
    if v_type <> 'text' or jsonb_typeof(p_node->'marks') is distinct from 'array' or jsonb_array_length(p_node->'marks') > 8 then raise exception 'invalid_input'; end if;
    for v_mark in select value from jsonb_array_elements(p_node->'marks') loop
      if jsonb_typeof(v_mark) is distinct from 'object' or coalesce(v_mark->>'type', '') not in ('bold', 'italic', 'strike', 'underline', 'code', 'link')
        or exists (select 1 from jsonb_object_keys(v_mark) k where k not in ('type', 'attrs')) then raise exception 'invalid_input'; end if;
      if v_mark ? 'attrs' and jsonb_typeof(v_mark->'attrs') is distinct from 'object' then raise exception 'invalid_input'; end if;
      if exists (select 1 from jsonb_each(coalesce(v_mark->'attrs', '{}'::jsonb)) a where jsonb_typeof(a.value) not in ('string', 'number', 'null')) then raise exception 'invalid_input'; end if;
      if v_mark->>'type' = 'link' and (coalesce(v_mark->'attrs'->>'href', '') !~* '^(https?://|mailto:)' or v_mark->'attrs'->>'href' ~ '[[:space:][:cntrl:]]') then raise exception 'invalid_input'; end if;
    end loop;
  end if;
  if v_type = 'hardBreak' then return E'\n'; end if;
  if v_type = 'image' then return ''; end if;
  if v_type = 'video' then return v_attrs->>'title' || case when nullif(v_attrs->>'caption', '') is null then '' else E'\n' || (v_attrs->>'caption') end; end if;
  if v_type = 'tableRow' then v_separator := E'\t';
  elsif v_type in ('doc', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'table', 'tableCell', 'tableHeader', 'callout', 'bibliography') then v_separator := E'\n'; end if;
  for v_child in select value from jsonb_array_elements(coalesce(p_node->'content', '[]'::jsonb)) loop
    if not v_first then v_result := v_result || v_separator; end if;
    v_result := v_result || public.validate_smu_rich_text(v_child, v_type, p_depth + 1);
    v_first := false;
  end loop;
  return v_result;
end;
$$;

revoke all on function public.validate_smu_rich_text(jsonb, text, integer) from public, anon, authenticated, service_role;
