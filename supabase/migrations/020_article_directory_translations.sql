-- Normalize article directory labels. Legacy RU/KK columns remain populated for
-- backwards compatibility while all three locales live in translation tables.

create table public.article_category_translations (
  category_id uuid not null references public.article_categories(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk', 'en')),
  name text not null check (length(btrim(name)) between 2 and 120),
  primary key(category_id, locale)
);
create table public.article_tag_translations (
  tag_id uuid not null references public.article_tags(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk', 'en')),
  name text not null check (length(btrim(name)) between 2 and 120),
  primary key(tag_id, locale)
);
create table public.article_type_translations (
  type_id uuid not null references public.article_types(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk', 'en')),
  name text not null check (length(btrim(name)) between 2 and 120),
  primary key(type_id, locale)
);
create table public.author_translations (
  author_id uuid not null references public.authors(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk', 'en')),
  name text not null check (length(btrim(name)) between 2 and 160),
  bio text check (bio is null or length(bio) <= 2000),
  primary key(author_id, locale)
);

insert into public.article_category_translations(category_id, locale, name)
  select id, 'ru', name_ru from public.article_categories union all
  select id, 'kk', name_kk from public.article_categories;
insert into public.article_tag_translations(tag_id, locale, name)
  select id, 'ru', name_ru from public.article_tags union all
  select id, 'kk', name_kk from public.article_tags;
insert into public.article_type_translations(type_id, locale, name)
  select id, 'ru', name_ru from public.article_types union all
  select id, 'kk', name_kk from public.article_types;
insert into public.author_translations(author_id, locale, name, bio)
  select id, 'ru', name_ru, bio_ru from public.authors union all
  select id, 'kk', name_kk, bio_kk from public.authors;

alter table public.article_category_translations enable row level security;
alter table public.article_tag_translations enable row level security;
alter table public.article_type_translations enable row level security;
alter table public.author_translations enable row level security;
grant select on public.article_category_translations, public.article_tag_translations,
  public.article_type_translations, public.author_translations to anon, authenticated;
create policy article_category_translations_read on public.article_category_translations for select to anon, authenticated
  using (exists(select 1 from public.article_categories i where i.id=category_id));
create policy article_tag_translations_read on public.article_tag_translations for select to anon, authenticated
  using (exists(select 1 from public.article_tags i where i.id=tag_id));
create policy article_type_translations_read on public.article_type_translations for select to anon, authenticated
  using (exists(select 1 from public.article_types i where i.id=type_id));
create policy author_translations_read on public.author_translations for select to anon, authenticated
  using (exists(select 1 from public.authors i where i.id=author_id));

alter function public.save_article_taxonomy(uuid,jsonb) rename to save_article_taxonomy_legacy_locales;
create function public.save_article_taxonomy(p_id uuid,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_kind text:=p_input->>'kind'; v_table text; v_key text; v_en text:=nullif(btrim(p_input->>'nameEn'),'');
begin
  v_id:=public.save_article_taxonomy_legacy_locales(p_id,p_input);
  v_table:=case v_kind when 'category' then 'article_category_translations' when 'tag' then 'article_tag_translations' when 'type' then 'article_type_translations' end;
  v_key:=case v_kind when 'category' then 'category_id' when 'tag' then 'tag_id' when 'type' then 'type_id' end;
  if v_table is null or (v_en is not null and length(v_en) not between 2 and 120) then raise exception 'invalid_input'; end if;
  execute format('insert into public.%I(%I,locale,name) values($1,''ru'',$2),($1,''kk'',$3) on conflict(%I,locale) do update set name=excluded.name',v_table,v_key,v_key)
    using v_id,btrim(p_input->>'nameRu'),btrim(p_input->>'nameKk');
  if v_en is null then execute format('delete from public.%I where %I=$1 and locale=''en''',v_table,v_key) using v_id;
  else execute format('insert into public.%I(%I,locale,name) values($1,''en'',$2) on conflict(%I,locale) do update set name=excluded.name',v_table,v_key,v_key) using v_id,v_en; end if;
  return v_id;
end $$;

alter function public.save_article_author(uuid,jsonb) rename to save_article_author_legacy_locales;
create function public.save_article_author(p_id uuid,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_en text:=nullif(btrim(p_input->>'nameEn'),''); v_bio_en text:=nullif(p_input->>'bioEn','');
begin
  if (v_en is null and v_bio_en is not null) or (v_en is not null and length(v_en) not between 2 and 160)
    or length(coalesce(v_bio_en,''))>2000 then raise exception 'invalid_input'; end if;
  v_id:=public.save_article_author_legacy_locales(p_id,p_input);
  insert into public.author_translations(author_id,locale,name,bio) values
    (v_id,'ru',btrim(p_input->>'nameRu'),nullif(p_input->>'bioRu','')),
    (v_id,'kk',btrim(p_input->>'nameKk'),nullif(p_input->>'bioKk',''))
    on conflict(author_id,locale) do update set name=excluded.name,bio=excluded.bio;
  if v_en is null then delete from public.author_translations where author_id=v_id and locale='en';
  else insert into public.author_translations(author_id,locale,name,bio) values(v_id,'en',v_en,v_bio_en)
    on conflict(author_id,locale) do update set name=excluded.name,bio=excluded.bio; end if;
  return v_id;
end $$;

revoke all on function public.save_article_taxonomy_legacy_locales(uuid,jsonb), public.save_article_author_legacy_locales(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.save_article_taxonomy(uuid,jsonb), public.save_article_author(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_article_taxonomy(uuid,jsonb), public.save_article_author(uuid,jsonb) to authenticated;
