-- Normalize scientific fields and organizations. Legacy RU/KK columns stay
-- synchronized for compatibility; optional English lives only in translations.

create table public.scientific_field_translations (
  field_id uuid not null references public.scientific_fields(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk', 'en')),
  name text not null check (length(btrim(name)) between 2 and 200),
  primary key(field_id, locale)
);

create table public.scientific_organization_translations (
  organization_id uuid not null references public.scientific_organizations(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk', 'en')),
  name text not null check (length(btrim(name)) between 2 and 200),
  city text check (city is null or length(btrim(city)) between 1 and 120),
  primary key(organization_id, locale)
);

insert into public.scientific_field_translations(field_id, locale, name)
  select id, 'ru', name_ru from public.scientific_fields union all
  select id, 'kk', name_kk from public.scientific_fields;
insert into public.scientific_organization_translations(organization_id, locale, name, city)
  select id, 'ru', name_ru, city_ru from public.scientific_organizations union all
  select id, 'kk', name_kk, city_kk from public.scientific_organizations;

alter table public.scientific_field_translations enable row level security;
alter table public.scientific_organization_translations enable row level security;
grant select on public.scientific_field_translations, public.scientific_organization_translations to anon, authenticated;
create policy scientific_field_translations_read on public.scientific_field_translations for select to anon, authenticated
  using (exists(select 1 from public.scientific_fields item where item.id=field_id));
create policy scientific_organization_translations_read on public.scientific_organization_translations for select to anon, authenticated
  using (exists(select 1 from public.scientific_organizations item where item.id=organization_id));

alter function public.create_scientist_taxonomy(jsonb) rename to create_scientist_taxonomy_legacy_locales;
create function public.create_scientist_taxonomy(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;
  v_kind text:=p_input->>'kind';
  v_name_en text:=nullif(btrim(p_input->>'nameEn'),'');
  v_city_en text:=nullif(btrim(p_input->>'cityEn'),'');
begin
  if (v_name_en is null and v_city_en is not null)
    or (v_name_en is not null and length(v_name_en) not between 2 and 200)
    or length(coalesce(v_city_en,''))>120 then raise exception 'invalid_input'; end if;
  v_id:=public.create_scientist_taxonomy_legacy_locales(p_input);
  if v_kind='field' then
    insert into public.scientific_field_translations(field_id,locale,name) values
      (v_id,'ru',btrim(p_input->>'nameRu')),(v_id,'kk',btrim(p_input->>'nameKk'))
      on conflict(field_id,locale) do update set name=excluded.name;
    if v_name_en is not null then
      insert into public.scientific_field_translations(field_id,locale,name) values(v_id,'en',v_name_en)
        on conflict(field_id,locale) do update set name=excluded.name;
    end if;
  elsif v_kind='organization' then
    insert into public.scientific_organization_translations(organization_id,locale,name,city) values
      (v_id,'ru',btrim(p_input->>'nameRu'),nullif(btrim(p_input->>'cityRu'),'')),
      (v_id,'kk',btrim(p_input->>'nameKk'),nullif(btrim(p_input->>'cityKk'),''))
      on conflict(organization_id,locale) do update set name=excluded.name,city=excluded.city;
    if v_name_en is not null then
      insert into public.scientific_organization_translations(organization_id,locale,name,city) values(v_id,'en',v_name_en,v_city_en)
        on conflict(organization_id,locale) do update set name=excluded.name,city=excluded.city;
    end if;
  else raise exception 'invalid_input'; end if;
  return v_id;
end $$;

revoke all on function public.create_scientist_taxonomy_legacy_locales(jsonb), public.create_scientist_taxonomy(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.create_scientist_taxonomy(jsonb) to authenticated;
