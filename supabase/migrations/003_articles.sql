create type public.article_status as enum (
  'draft',
  'in_review',
  'approved',
  'published',
  'archived'
);

create type public.article_content_type as enum (
  'article',
  'news',
  'interview',
  'announcement'
);

create table public.article_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name_ru text not null,
  name_kk text not null,
  description_ru text,
  description_kk text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name_ru text not null,
  name_kk text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid references public.article_categories(id) on delete set null,
  cover_media_id uuid references public.media_assets(id) on delete set null,
  content_type public.article_content_type not null default 'article',
  status public.article_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (status <> 'published' or published_at is not null)
);

create table public.article_translations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  locale text not null check (locale in ('ru', 'kk')),
  title text not null,
  slug text not null check (slug = lower(slug)),
  excerpt text not null,
  body text not null,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, locale),
  unique (locale, slug)
);

create table public.article_tag_links (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.article_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (article_id, tag_id)
);

create index articles_status_published_at_idx
  on public.articles(status, published_at desc)
  where deleted_at is null;
create index articles_author_id_idx
  on public.articles(author_id, updated_at desc)
  where deleted_at is null;
create index articles_category_id_idx
  on public.articles(category_id)
  where deleted_at is null;
create index article_translations_article_id_idx
  on public.article_translations(article_id);
create index article_translations_title_search_idx
  on public.article_translations using gin (to_tsvector('simple', title));
create index article_tag_links_tag_id_idx on public.article_tag_links(tag_id);

create trigger article_categories_set_updated_at
before update on public.article_categories
for each row execute function public.set_updated_at();

create trigger article_tags_set_updated_at
before update on public.article_tags
for each row execute function public.set_updated_at();

create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

create trigger article_translations_set_updated_at
before update on public.article_translations
for each row execute function public.set_updated_at();

create or replace function public.sync_article_cover_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.media_usages
    where entity_type = 'article'
      and entity_id = old.id
      and field_name = 'cover';
    return old;
  end if;

  delete from public.media_usages
  where entity_type = 'article'
    and entity_id = new.id
    and field_name = 'cover';

  if new.cover_media_id is not null and new.deleted_at is null then
    insert into public.media_usages (
      media_asset_id,
      entity_type,
      entity_id,
      field_name
    ) values (
      new.cover_media_id,
      'article',
      new.id,
      'cover'
    ) on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_article_cover_usage() from public;

create trigger articles_sync_cover_usage
after insert or update of cover_media_id, deleted_at or delete on public.articles
for each row execute function public.sync_article_cover_usage();

alter table public.article_categories enable row level security;
alter table public.article_tags enable row level security;
alter table public.articles enable row level security;
alter table public.article_translations enable row level security;
alter table public.article_tag_links enable row level security;

create policy "article_categories_read_active"
on public.article_categories for select
to anon, authenticated
using (is_active);

create policy "article_categories_read_editorial"
on public.article_categories for select
to authenticated
using (
  public.has_permission('articles.create')
  or public.has_permission('articles.edit_any')
);

create policy "article_tags_read_active"
on public.article_tags for select
to anon, authenticated
using (is_active);

create policy "article_tags_read_editorial"
on public.article_tags for select
to authenticated
using (
  public.has_permission('articles.create')
  or public.has_permission('articles.edit_any')
);

create policy "articles_read_published"
on public.articles for select
to anon, authenticated
using (
  status = 'published'
  and published_at <= now()
  and deleted_at is null
);

create policy "articles_read_editorial"
on public.articles for select
to authenticated
using (
  deleted_at is null
  and (
    (author_id = auth.uid() and public.has_permission('articles.edit_own'))
    or public.has_permission('articles.edit_any')
    or public.has_permission('articles.review')
    or public.has_permission('articles.publish')
  )
);

create policy "article_translations_read_visible"
on public.article_translations for select
to anon, authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id
  )
);

create policy "article_tag_links_read_visible"
on public.article_tag_links for select
to anon, authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id
  )
);

comment on table public.articles is
  'Language-neutral article record with editorial workflow state.';
comment on table public.article_translations is
  'Required Russian and Kazakh article versions with locale-scoped slugs.';
comment on table public.article_categories is
  'Bilingual article category taxonomy.';
comment on table public.article_tags is
  'Bilingual article tag taxonomy.';
