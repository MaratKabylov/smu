-- Migration 046: Open Data Aktobe initiative
begin;

insert into public.permissions(code, name) values
  ('open_data.manage', 'Управление Open Data Aktobe')
on conflict(code) do update set name = excluded.name;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code in ('admin', 'super_admin', 'content_manager', 'project_manager')
  and p.code = 'open_data.manage'
on conflict do nothing;

-- 1. General settings
create table public.open_data_settings (
  id uuid primary key default gen_random_uuid(),
  title_ru text not null default 'Open Data Aktobe',
  title_kk text not null default 'Open Data Aktobe',
  subtitle_ru text not null default 'Данные сегодня — открытия завтра.',
  subtitle_kk text not null default 'Бүгінгі деректер — ертеңгі жаңалықтар.',
  short_description_ru text not null default 'Мы формируем единую базу научных данных Актюбинской области, чтобы обеспечить исследователей необходимыми ресурсами для проведения научных исследований и новых открытий.',
  short_description_kk text not null default 'Біз зерттеушілерді ғылыми зерттеулер жүргізуге және жаңа жаңалықтар ашуға қажетті ресурстармен қамтамасыз ету үшін Ақтөбе облысының бірыңғай ғылыми деректер қорын қалыптастырып жатырмыз.',
  description_ru text not null default 'Open Data Aktobe — инициатива Совета молодых учёных по созданию единой платформы научных данных Актюбинской области.

Мы собираем, систематизируем и сохраняем региональные данные, которые в дальнейшем смогут использовать учёные для проведения исследований, анализа и разработки новых научных проектов.

В настоящее время ведётся формирование базы данных. После запуска исследовательские инструменты будут доступны учёным через личный кабинет СМУ.',
  description_kk text not null default 'Open Data Aktobe — Ақтөбе облысының бірыңғай ғылыми деректер платформасын құруға бағытталған Жас ғалымдар кеңесінің бастамасы.

Біз ғалымдар болашақта зерттеулер жүргізу, талдау жасау және жаңа ғылыми жобаларды әзірлеу үшін пайдалана алатын өңірлік деректерді жинап, жүйелеп, сақтаймыз.

Қазіргі уақытта деректер қоры қалыптастырылуда. Платформа іске қосылғаннан кейін зерттеу құралдары ғалымдарға Жас ғалымдар кеңесінің сайтындағы жеке кабинет арқылы қолжетімді болады.',
  status text not null default 'collecting',
  status_text_ru text not null default 'Ведётся сбор и систематизация данных.',
  status_text_kk text not null default 'Деректерді жинау және жүйелеу жұмыстары жүргізілуде.',
  collaboration_text_ru text not null default 'Располагаете научными данными об Актюбинской области?

Помогите нам сформировать единую базу научных данных региона. Мы приглашаем учёных, университеты, исследовательские организации и независимых исследователей к сотрудничеству.',
  collaboration_text_kk text not null default 'Ақтөбе облысы туралы ғылыми деректеріңіз бар ма?

Өңірдің бірыңғай ғылыми деректер қорын қалыптастыруға үлес қосыңыз. Біз ғалымдарды, университеттерді, зерттеу ұйымдарын және тәуелсіз зерттеушілерді ынтымақтастыққа шақырамыз.',
  is_published boolean not null default true,
  show_on_homepage boolean not null default true,
  data_updated_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Informational metrics
create table public.open_data_metrics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) >= 2),
  title_ru text not null check (length(trim(title_ru)) >= 1),
  title_kk text not null check (length(trim(title_kk)) >= 1),
  value_numeric numeric null check (value_numeric is null or value_numeric >= 0),
  value_text_ru text null,
  value_text_kk text null,
  unit_ru text not null default '',
  unit_kk text not null default '',
  icon text not null default 'database',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  show_on_homepage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Data categories
create table public.open_data_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 2 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_ru text not null check (length(trim(title_ru)) >= 1),
  title_kk text not null check (length(trim(title_kk)) >= 1),
  description_ru text not null default '',
  description_kk text not null default '',
  icon text not null default 'folder',
  dataset_count integer null check (dataset_count is null or dataset_count >= 0),
  status text not null default 'collecting' check (status in ('planned', 'collecting', 'processing', 'collected')),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  show_on_homepage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Informational records of data arrival
create table public.open_data_updates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.open_data_categories(id) on delete cascade,
  title_ru text not null check (length(trim(title_ru)) >= 1),
  title_kk text not null check (length(trim(title_kk)) >= 1),
  description_ru text not null default '',
  description_kk text not null default '',
  source_name text not null check (length(trim(source_name)) >= 1),
  source_url text null check (source_url is null or source_url ~ '^https?://[^\s/$.?#].[^\s]*$'),
  period_start text null,
  period_end text null,
  received_at date not null default current_date,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index open_data_metrics_order_idx on public.open_data_metrics(sort_order, is_visible);
create index open_data_categories_order_idx on public.open_data_categories(sort_order, is_visible);
create index open_data_updates_published_idx on public.open_data_updates(is_published, received_at desc);
create index open_data_updates_category_idx on public.open_data_updates(category_id);

-- Updated_at triggers
create trigger open_data_settings_set_updated_at
before update on public.open_data_settings
for each row execute function public.set_updated_at();

create trigger open_data_metrics_set_updated_at
before update on public.open_data_metrics
for each row execute function public.set_updated_at();

create trigger open_data_categories_set_updated_at
before update on public.open_data_categories
for each row execute function public.set_updated_at();

create trigger open_data_updates_set_updated_at
before update on public.open_data_updates
for each row execute function public.set_updated_at();

-- RLS setup
alter table public.open_data_settings enable row level security;
alter table public.open_data_metrics enable row level security;
alter table public.open_data_categories enable row level security;
alter table public.open_data_updates enable row level security;

revoke all on public.open_data_settings, public.open_data_metrics,
  public.open_data_categories, public.open_data_updates from public, anon, authenticated;

grant select on public.open_data_settings, public.open_data_metrics,
  public.open_data_categories, public.open_data_updates to anon, authenticated;

grant insert, update, delete on public.open_data_settings, public.open_data_metrics,
  public.open_data_categories, public.open_data_updates to authenticated;

-- Policies for anon & authenticated reads
create policy open_data_settings_read on public.open_data_settings
  for select to anon, authenticated
  using (is_published = true or public.has_permission('open_data.manage'));

create policy open_data_metrics_read on public.open_data_metrics
  for select to anon, authenticated
  using (is_visible = true or public.has_permission('open_data.manage'));

create policy open_data_categories_read on public.open_data_categories
  for select to anon, authenticated
  using (is_visible = true or public.has_permission('open_data.manage'));

create policy open_data_updates_read on public.open_data_updates
  for select to anon, authenticated
  using (is_published = true or public.has_permission('open_data.manage'));

-- Policies for authenticated management
create policy open_data_settings_manage on public.open_data_settings
  for all to authenticated
  using (public.has_permission('open_data.manage'))
  with check (public.has_permission('open_data.manage'));

create policy open_data_metrics_manage on public.open_data_metrics
  for all to authenticated
  using (public.has_permission('open_data.manage'))
  with check (public.has_permission('open_data.manage'));

create policy open_data_categories_manage on public.open_data_categories
  for all to authenticated
  using (public.has_permission('open_data.manage'))
  with check (public.has_permission('open_data.manage'));

create policy open_data_updates_manage on public.open_data_updates
  for all to authenticated
  using (public.has_permission('open_data.manage'))
  with check (public.has_permission('open_data.manage'));

-- Initial default seed data
insert into public.open_data_settings (
  id,
  title_ru, title_kk,
  subtitle_ru, subtitle_kk,
  short_description_ru, short_description_kk,
  description_ru, description_kk,
  status, status_text_ru, status_text_kk,
  collaboration_text_ru, collaboration_text_kk,
  is_published, show_on_homepage
) values (
  '00000000-0000-4000-a000-000000000901',
  'Open Data Aktobe', 'Open Data Aktobe',
  'Данные сегодня — открытия завтра.', 'Бүгінгі деректер — ертеңгі жаңалықтар.',
  'Мы формируем единую базу научных данных Актюбинской области, чтобы обеспечить исследователей необходимыми ресурсами для проведения научных исследований и новых открытий.',
  'Біз зерттеушілерді ғылыми зерттеулер жүргізуге және жаңа жаңалықтар ашуға қажетті ресурстармен қамтамасыз ету үшін Ақтөбе облысының бірыңғай ғылыми деректер қорын қалыптастырып жатырмыз.',
  'Open Data Aktobe — инициатива Совета молодых учёных по созданию единой платформы научных данных Актюбинской области.

Мы собираем, систематизируем и сохраняем региональные данные, которые в дальнейшем смогут использовать учёные для проведения исследований, анализа и разработки новых научных проектов.

В настоящее время ведётся формирование базы данных. После запуска исследовательские инструменты будут доступны учёным через личный кабинет СМУ.',
  'Open Data Aktobe — Ақтөбе облысының бірыңғай ғылыми деректер платформасын құруға бағытталған Жас ғалымдар кеңесінің бастамасы.

Біз ғалымдар болашақта зерттеулер жүргізу, талдау жасау және жаңа ғылыми жобаларды әзірлеу үшін пайдалана алатын өңірлік деректерді жинап, жүйелеп, сақтаймыз.

Қазіргі уақытта деректер қоры қалыптастырылуда. Платформа іске қосылғаннан кейін зерттеу құралдары ғалымдарға Жас ғалымдар кеңесінің сайтындағы жеке кабинет арқылы қолжетімді болады.',
  'collecting',
  'Ведётся сбор и систематизация данных.',
  'Деректерді жинау және жүйелеу жұмыстары жүргізілуде.',
  'Располагаете научными данными об Актюбинской области?

Помогите нам сформировать единую базу научных данных региона. Мы приглашаем учёных, университеты, исследовательские организации и независимых исследователей к сотрудничеству.',
  'Ақтөбе облысы туралы ғылыми деректеріңіз бар ма?

Өңірдің бірыңғай ғылыми деректер қорын қалыптастыруға үлес қосыңыз. Біз ғалымдарды, университеттерді, зерттеу ұйымдарын және тәуелсіз зерттеушілерді ынтымақтастыққа шақырамыз.',
  true, true
);

-- Seed initial metrics from Section 5.2
insert into public.open_data_metrics (code, title_ru, title_kk, value_numeric, value_text_ru, value_text_kk, unit_ru, unit_kk, icon, sort_order, is_visible, show_on_homepage) values
  ('datasets_count', 'Количество наборов данных', 'Деректер жиынтығының саны', null, null, null, '', '', 'database', 1, true, true),
  ('sources_count', 'Количество источников', 'Дереккөздер саны', null, null, null, '', '', 'layers', 2, true, true),
  ('records_count', 'Количество записей', 'Жазбалар саны', null, null, null, '', '', 'file-text', 3, true, true),
  ('scientific_areas_count', 'Количество научных направлений', 'Ғылыми бағыттар саны', null, null, null, '', '', 'sparkles', 4, true, true),
  ('data_volume', 'Общий объём данных', 'Деректердің жалпы көлемі', null, null, null, 'ГБ', 'ГБ', 'hard-drive', 5, true, false),
  ('geo_coverage', 'Географический охват', 'Географиялық қамту', null, 'Актюбинская область', 'Ақтөбе облысы', '', '', 'map-pin', 6, true, false),
  ('temporal_coverage', 'Временной охват', 'Уақыттық қамту', null, null, null, '', '', 'calendar', 7, true, false);

-- Seed initial categories from Section 5.3
insert into public.open_data_categories (slug, title_ru, title_kk, description_ru, description_kk, icon, dataset_count, status, sort_order, is_visible, show_on_homepage) values
  ('ecology', 'Экология', 'Экология', 'Мониторинг состояния окружающей среды, выбросов и полигонов', 'Қоршаған орта жағдайын, шығарындыларды және полигондарды бақылау', 'leaf', null, 'collecting', 1, true, true),
  ('demography', 'Демография', 'Демография', 'Динамика численности населения, миграция и половозрастной состав', 'Халық санының серпіні, көші-қон және жыныс-жас құрамы', 'users', null, 'collecting', 2, true, true),
  ('climate', 'Климат и метеорология', 'Климат және метеорология', 'Температурные режимы, осадки, влажность и атмосферные явления', 'Температуралық режимдер, жауын-шашын, ылғалдылық және атмосфералық құбылыстар', 'cloud-sun', null, 'collecting', 3, true, true),
  ('water-resources', 'Водные ресурсы', 'Су ресурстары', 'Состояние рек, водохранилищ, подземных вод и водопользования', 'Өзендер, су қоймалары, жер асты сулары және су пайдалану жағдайы', 'droplets', null, 'collecting', 4, true, true),
  ('transport', 'Транспорт и инфраструктура', 'Көлік және инфрақұрылым', 'Транспортная сеть, пассажиропоток и дорожная инфраструктура', 'Көлік желісі, жолаушылар ағыны және жол инфрақұрылымы', 'truck', null, 'collecting', 5, true, true),
  ('gis', 'Географические данные', 'Географиялық деректер', 'Пространственные слои, границы районов и топографическая основа', 'Кеңістіктік қабаттар, аудан шекаралары және топографиялық негіз', 'map-pin', null, 'collecting', 6, true, true),
  ('economy', 'Экономика и статистика', 'Экономика және статистика', 'Макроэкономические индикаторы, производство и региональный бюджет', 'Макроэкономикалық индикаторлар, өндіріс және өңірлік бюджет', 'trending-up', null, 'planned', 7, true, false),
  ('natural-resources', 'Природные ресурсы', 'Табиғи ресурстар', 'Полезные ископаемые, месторождения и сырьевая база региона', 'Пайдалы қазбалар, кен орындары және өңірдің шикізат базасы', 'mountain', null, 'planned', 8, true, false),
  ('health', 'Здравоохранение', 'Денсаулық сақтау', 'Медицинская инфраструктура, заболеваемость и демографическое здоровье', 'Медициналық инфрақұрылым, аурушаңдық және халық денсаулығы', 'heart-pulse', null, 'planned', 9, true, false),
  ('education', 'Образование', 'Білім беру', 'Сеть образовательных учреждений, контингент и научный потенциал', 'Білім беру мекемелерінің желісі, контингент және ғылыми әлеует', 'graduation-cap', null, 'planned', 10, true, false),
  ('agriculture', 'Сельское хозяйство', 'Ауыл шаруашылығы', 'Посевные площади, животноводство, урожайность и пастбища', 'Егіс алқаптары, мал шаруашылығы, өнімділік және жайылымдар', 'sprout', null, 'planned', 11, true, false),
  ('biodiversity', 'Биоразнообразие', 'Биологиялық әртүрлілік', 'Флора, фауна, особо охраняемые природные территории и ареалы', 'Флора, фауна, ерекше қорғалатын табиғи аумақтар және мекендеу орталары', 'bug', null, 'planned', 12, true, false),
  ('wildfires', 'Природные пожары', 'Табиғи өрттер', 'Очаги возгораний, степные пожары и оценка риска', 'Өрт ошақтары, дала өрттері және тәуекелдерді бағалау', 'flame', null, 'planned', 13, true, false),
  ('urbanistics', 'Урбанистика', 'Урбанистика', 'Городская среда, застройка, общественные пространства и зонирование', 'Қалалық орта, құрылыс, қоғамдық кеңістіктер және аймақтарға бөлу', 'building-2', null, 'planned', 14, true, false),
  ('history', 'Исторические данные', 'Тарихи деректер', 'Историко-культурное наследие, архивы и археологические памятники', 'Тарихи-мәдени мұра, мұрағаттар және археологиялық ескерткіштер', 'landmark', null, 'planned', 15, true, false);

commit;
