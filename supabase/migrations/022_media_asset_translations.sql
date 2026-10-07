-- Normalize localized media metadata. Legacy RU/KK columns stay synchronized
-- while all locales, including optional English, live in translation rows.

create table public.media_asset_translations (
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk', 'en')),
  alt_text text check (alt_text is null or length(alt_text) <= 2000),
  caption text check (caption is null or length(caption) <= 2000),
  primary key (media_asset_id, locale)
);

insert into public.media_asset_translations(media_asset_id, locale, alt_text, caption)
  select id, 'ru', alt_ru, caption_ru from public.media_assets
  union all
  select id, 'kk', alt_kk, caption_kk from public.media_assets;

alter table public.media_asset_translations enable row level security;
grant select on public.media_asset_translations to anon, authenticated;
create policy media_asset_translations_read on public.media_asset_translations
  for select to anon, authenticated
  using (exists(select 1 from public.media_assets asset where asset.id=media_asset_id));

create function public.save_media_metadata(p_id uuid, p_input jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_alt_en text:=nullif(btrim(p_input->>'altEn'),'');
  v_caption_en text:=nullif(btrim(p_input->>'captionEn'),'');
begin
  if jsonb_typeof(p_input)<>'object'
    or length(coalesce(p_input->>'altRu',''))>2000
    or length(coalesce(p_input->>'altKk',''))>2000
    or length(coalesce(p_input->>'captionRu',''))>2000
    or length(coalesce(p_input->>'captionKk',''))>2000
    or length(coalesce(v_alt_en,''))>2000
    or length(coalesce(v_caption_en,''))>2000 then raise exception 'invalid_input'; end if;

  update public.media_assets set
    alt_ru=nullif(btrim(p_input->>'altRu'),''), alt_kk=nullif(btrim(p_input->>'altKk'),''),
    caption_ru=nullif(btrim(p_input->>'captionRu'),''), caption_kk=nullif(btrim(p_input->>'captionKk'),''),
    copyright_holder=nullif(btrim(p_input->>'copyrightHolder'),''),
    source_url=nullif(btrim(p_input->>'sourceUrl'),'')
  where id=p_id and deleted_at is null;
  if not found then raise exception 'not_found'; end if;

  insert into public.media_asset_translations(media_asset_id,locale,alt_text,caption) values
    (p_id,'ru',nullif(btrim(p_input->>'altRu'),''),nullif(btrim(p_input->>'captionRu'),'')),
    (p_id,'kk',nullif(btrim(p_input->>'altKk'),''),nullif(btrim(p_input->>'captionKk'),''))
    on conflict(media_asset_id,locale) do update set alt_text=excluded.alt_text,caption=excluded.caption;
  if v_alt_en is null and v_caption_en is null then
    delete from public.media_asset_translations where media_asset_id=p_id and locale='en';
  else
    insert into public.media_asset_translations(media_asset_id,locale,alt_text,caption)
      values(p_id,'en',v_alt_en,v_caption_en)
      on conflict(media_asset_id,locale) do update set alt_text=excluded.alt_text,caption=excluded.caption;
  end if;
end $$;

revoke all on function public.save_media_metadata(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_media_metadata(uuid,jsonb) to service_role;
