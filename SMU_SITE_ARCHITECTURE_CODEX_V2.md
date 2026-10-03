# SMU / Совет молодых ученых — архитектура сайта для Codex v2

> Обновленная архитектура с полноценной собственной административной панелью и CMS-модулем.
>
> Основной стек: **Next.js + TypeScript + Supabase + Vercel**.
>
> Принцип: не подключать отдельную внешнюю CMS как основной источник данных. Административная панель является частью приложения SMU и работает с той же базой данных Supabase, что и публичный сайт.

---

# 1. Назначение проекта

Сайт общественного фонда **«Совет молодых ученых» (СМУ)** должен быть не обычным корпоративным сайтом, а цифровой платформой научного сообщества Актюбинской области.

Главная идея:

> СМУ объединяет ученых региона, помогает им находить возможности, участвовать в исследованиях, получать поддержку, создавать прикладные проекты для региона и популяризировать науку.

Система должна одновременно выполнять несколько функций:

1. каталог ученых Актюбинской области;
2. площадка для региональных исследований;
3. система научного наставничества;
4. инфраструктура SMU Research Program;
5. поддержка публикаций и международных возможностей;
6. прием заявок на IT-помощь ученым;
7. база возможностей, грантов и событий;
8. научно-популярное медиа / блог СМУ;
9. административная система для управления всем перечисленным.

---

# 2. Ключевой архитектурный принцип

## 2.1. Одна платформа, одна база данных

Не создавать отдельные независимые системы:

```text
сайт
CMS
каталог ученых
исследовательская база
админка
```

Все должно быть частью одного продукта:

```text
                  SMU Platform
                       │
        ┌──────────────┼──────────────┐
        │              │              │
 Public website    User account    SMU Admin
        │              │              │
        └──────────────┼──────────────┘
                       │
                   Supabase
             PostgreSQL/Auth/Storage
```

Это позволяет связывать между собой:

- ученых;
- публикации;
- статьи;
- исследования;
- проекты;
- организации;
- наставничество;
- события;
- возможности;
- авторов;
- медиа;
- заявки;
- результаты.

---

## 2.2. Ученый — центральная сущность

Большинство объектов системы должны иметь возможность связи с ученым:

```text
Scientist
 ├─ Publications
 ├─ Articles
 ├─ Projects
 ├─ Research
 ├─ Events
 ├─ Mentorship
 ├─ Research Program
 ├─ IT requests
 ├─ Scientific reviews
 └─ Opportunities / participation
```

---

## 2.3. CMS — не отдельный продукт

В проекте должна быть **собственная административная панель**.

Она начинается как CMS для статей и контента, но архитектурно сразу проектируется как единый back-office всей платформы.

URL:

```text
/admin
```

Внешние CMS вроде WordPress, Strapi, Directus, Sanity и Payload не являются основой архитектуры проекта.

Допускается использование готовых open-source компонентов для редактора текста, загрузки файлов, таблиц и UI, но бизнес-логика, модели данных и permissions принадлежат SMU.

---

# 3. Технологический стек

## Frontend / application

```text
Next.js latest stable
TypeScript
App Router
React Server Components
Server Actions
Route Handlers
Tailwind CSS
shadcn/ui
Lucide Icons
```

## Backend

Основная backend-логика реализуется внутри Next.js.

Слои:

```text
UI
 ↓
Server Action / Route Handler
 ↓
Service
 ↓
Repository
 ↓
Supabase/PostgreSQL
```

Не обращаться к Supabase напрямую из десятков React-компонентов.

---

## Database

```text
Supabase
PostgreSQL
Supabase Auth
Supabase Storage
Row Level Security
PostgreSQL Full Text Search
```

---

## Deployment

```text
GitHub
  ↓
Vercel
  ↓
Next.js application
  ↓
Supabase
```

Production schema изменяется только через migrations.

```text
supabase/
  migrations/
  seed.sql
```

Не изменять production schema вручную через UI без соответствующей migration.

---

# 4. Языки

Обязательные:

```text
ru
kk
```

Архитектурно предусмотреть:

```text
en
```

Публичная маршрутизация:

```text
/ru/...
/kk/...
/en/...   // позднее
```

Для крупных CMS-сущностей не дублировать все поля в одной таблице через `title_ru`, `title_kk`, `content_ru`, `content_kk`.

Использовать основную сущность + translations.

Пример:

```text
articles
article_translations
```

Это особенно важно для:

- статей;
- страниц;
- проектов;
- исследований;
- событий;
- больших описаний организаций.

---

# 5. Основная публичная структура сайта

```text
Главная
│
├── Ученые
│   ├── Каталог ученых
│   ├── Профиль ученого
│   ├── Организации
│   └── Научные направления
│
├── Исследования
│   ├── Региональные исследования
│   ├── Исследовательские проекты
│   ├── Карта исследований
│   ├── Предложить проблему
│   └── Результаты исследований
│
├── Наставничество
│   ├── Найти наставника
│   ├── Найти ученика
│   ├── Темы исследований
│   ├── Наставники
│   └── Научное наследие
│
├── SMU Research Program
│   ├── О программе
│   ├── Проекты
│   ├── Участники
│   ├── Наставники
│   └── Подать заявку
│
├── Поддержка ученых
│   ├── Научные публикации
│   ├── Международные возможности
│   ├── IT для ученых
│   ├── Гранты и конкурсы
│   └── Запросить помощь
│
├── Журнал / Наука просто
│   ├── Все материалы
│   ├── Научпоп
│   ├── Люди науки
│   ├── История науки
│   ├── Исследования региона
│   ├── Разбор исследований
│   ├── Новости науки
│   ├── Интервью
│   ├── Видео
│   └── Авторы
│
├── Возможности
│   ├── Гранты
│   ├── Конференции
│   ├── Стажировки
│   ├── Конкурсы
│   └── Open Calls
│
├── События
│
├── О СМУ
│   ├── О фонде
│   ├── Команда
│   ├── Партнеры
│   ├── Документы
│   └── Контакты
│
└── Личный кабинет
```

---

# 6. CMS / Журнал СМУ

CMS должна поддерживать не только обычные новости, а полноценную редакционную работу.

## 6.1. Типы материалов

`article_type`:

```text
science_popular
research_explainer
regional_research
scientist_story
scientist_birthday
interview
news
opinion
event_report
project_update
guide
video
announcement
other
```

Тип должен быть отдельным справочником или enum только если список стабилен.

Предпочтительно справочник `article_types`, чтобы администратор мог позже расширять его без migration.

---

# 7. Структура статьи

Основная таблица:

```sql
articles

id uuid pk
slug text unique

type_id uuid
status text

author_profile_id uuid nullable
scientific_reviewer_id uuid nullable
created_by uuid
updated_by uuid

cover_media_id uuid nullable

featured boolean default false
allow_comments boolean default false

published_at timestamptz nullable
scheduled_at timestamptz nullable

created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

---

## 7.1. Переводы статьи

```sql
article_translations

id uuid pk
article_id uuid fk
locale text

title text
subtitle text nullable
excerpt text
content_json jsonb
content_html text nullable

seo_title text nullable
seo_description text nullable
og_title text nullable
og_description text nullable

created_at timestamptz
updated_at timestamptz

unique(article_id, locale)
```

`content_json` является основным структурированным содержимым редактора.

`content_html` можно хранить как кеш/сгенерированное представление, если это потребуется для производительности.

Нельзя считать HTML единственным исходным форматом материала.

---

# 8. Редактор статей

Использовать готовый React-редактор, предпочтительно:

```text
TipTap
```

Не писать WYSIWYG-редактор с нуля.

Редактор должен поддерживать:

- заголовки H2/H3/H4;
- обычный текст;
- bold / italic;
- ссылки;
- списки;
- цитаты;
- изображения;
- подписи к изображениям;
- видео/embed;
- таблицы;
- разделитель;
- callout;
- code block при необходимости;
- научные ссылки / bibliography block;
- связанные материалы;
- блок «Об авторе»;
- блок «Источник / DOI»;
- preview.

В дальнейшем можно добавить собственные блоки:

```text
ScientistCard
ResearchCard
ProjectCard
PublicationCard
DatasetCard
EventCard
QuoteCard
FactCard
```

Это позволит в статье вставлять живую карточку объекта из БД, а не копировать информацию вручную.

---

# 9. Workflow публикации

Статусы:

```text
draft
review
changes_requested
approved
scheduled
published
archived
```

Workflow:

```text
Автор / редактор
      ↓
    draft
      ↓
    review
      ↓
scientific reviewer / chief editor
      ↓
 approved
      ↓
scheduled / published
```

Для научных и научно-популярных материалов должна поддерживаться научная рецензия.

Не все статьи обязаны проходить scientific review.

Поле:

```text
requires_scientific_review boolean
```

---

# 10. Автосохранение и черновики

Редактор должен иметь:

- автосохранение;
- индикатор состояния сохранения;
- предупреждение при выходе с несохраненными изменениями;
- preview до публикации.

Для крупных текстов не выполнять `UPDATE` на каждый символ.

Использовать debounce.

---

# 11. История версий

Создать:

```sql
article_revisions

id uuid pk
article_id uuid
locale text

revision_number integer

title text
excerpt text
content_json jsonb

created_by uuid
created_at timestamptz
```

Ревизия создается:

```text
при отправке на review
при публикации
по команде "Создать версию"
```

Не нужно создавать revision на каждое автосохранение.

Администратор должен иметь возможность:

```text
посмотреть историю
сравнить версии
восстановить предыдущую версию
```

---

# 12. Категории

```sql
article_categories

id uuid pk
slug text unique
parent_id uuid nullable
sort_order integer
is_active boolean
created_at timestamptz
updated_at timestamptz
```

Переводы:

```sql
article_category_translations

id
category_id
locale
name
description
```

Связь:

```sql
article_category_links

article_id
category_id

unique(article_id, category_id)
```

Статья может иметь несколько категорий.

---

# 13. Теги

```sql
tags

id uuid
slug text unique
name text
created_at timestamptz
```

```sql
article_tags

article_id
tag_id
```

Теги в первой версии могут быть едиными для всех языков.

---

# 14. Связи статьи с объектами SMU

Это принципиально важная часть архитектуры.

Статья может быть связана с:

```text
ученым
организацией
проектом
исследованием
событием
научным направлением
публикацией
Research Program
```

Не хранить эти связи только внутри текста.

Создать отдельные таблицы связей.

Например:

```sql
article_scientists
article_projects
article_organizations
article_research_fields
article_events
article_publications
```

Пример:

```sql
article_scientists

article_id uuid
scientist_id uuid
relation_type text
```

`relation_type`:

```text
author
subject
expert
mentioned
reviewer
```

Благодаря этому в профиле ученого автоматически можно показывать:

```text
Статьи автора
Материалы об ученом
Интервью
Комментарии эксперта
Связанные исследования
```

---

# 15. Авторы

Автор статьи не всегда является зарегистрированным ученым.

Поддержать:

```text
profile author
external author
editorial team
```

Таблица:

```sql
authors

id uuid
profile_id uuid nullable

display_name text
bio text nullable
photo_media_id uuid nullable

organization text nullable
position text nullable

website_url text nullable

is_active boolean
created_at timestamptz
updated_at timestamptz
```

Статья может иметь нескольких авторов.

```sql
article_authors

article_id
author_id
sort_order
role
```

role:

```text
author
coauthor
editor
translator
```

---

# 16. Медиа-библиотека

Не хранить изображения в поле статьи как случайные URL.

Создать централизованную media library.

```sql
media_assets

id uuid
storage_bucket text
storage_path text

file_name text
mime_type text
file_size bigint

width integer nullable
height integer nullable

alt_ru text nullable
alt_kk text nullable

caption_ru text nullable
caption_kk text nullable

copyright_holder text nullable
source_url text nullable

uploaded_by uuid
created_at timestamptz
deleted_at timestamptz nullable
```

Supabase Storage buckets:

```text
avatars
organization-logos
article-media
research-files
publication-files
event-media
documents
it-request-files
```

Admin UI:

```text
/admin/media
```

Функции:

- загрузить;
- найти;
- отфильтровать;
- посмотреть где используется;
- отредактировать alt/caption;
- выбрать ранее загруженное;
- soft delete.

---

# 17. SEO

Для публикации поддержать:

```text
slug
SEO title
SEO description
canonical URL
OpenGraph title
OpenGraph description
OpenGraph image
noindex
```

При отсутствии отдельных SEO-полей:

```text
seo_title ← title
seo_description ← excerpt
og_title ← title
og_description ← excerpt
og_image ← cover
```

Генерировать:

```text
sitemap.xml
robots.txt
RSS / feed
OpenGraph metadata
JSON-LD Article
JSON-LD Person
JSON-LD Organization
```

---

# 18. Preview

Редактор должен иметь кнопку:

```text
Предпросмотр
```

Preview не должен требовать публикации статьи.

Возможный URL:

```text
/admin/articles/[id]/preview
```

или защищенный preview route с временным token.

Не отдавать draft через публичный API без проверки разрешений.

---

# 19. Планирование публикаций

Поддержать:

```text
scheduled_at
```

Статья со статусом `scheduled` становится публичной после наступления времени публикации.

Реализация:

```text
Vercel Cron
или
проверка published_at <= now() на чтении
```

Предпочтительно хранить реальное состояние в БД и выполнять scheduled job.

---

# 20. Статические страницы

CMS должна позволять редактировать часть информационных страниц без изменения кода.

Пример:

```text
О СМУ
Research Program
IT для ученых
Поддержка публикаций
Контакты
```

Не превращать весь сайт в произвольный page builder.

Создать ограниченный тип:

```sql
content_pages
content_page_translations
```

Страница имеет заранее определенный template.

Например:

```text
standard
landing
program
support
```

Администратор редактирует контент, но не архитектуру приложения.

---

# 21. Главная страница

Главная страница не должна быть полностью свободным page builder.

Использовать управляемые блоки.

Например:

```text
hero
featured_research
featured_scientists
research_program
mentorship
scientist_support
latest_articles
opportunities
events
results
partners
```

Для блока можно хранить:

```text
enabled
sort_order
title override
selected entities
display limit
```

Создать:

```sql
homepage_sections
```

Это дает администратору контроль без риска сломать дизайн.

---

# 22. Административная панель

URL:

```text
/admin
```

Это отдельный layout внутри того же Next.js приложения.

Пример:

```text
src/app/admin/
```

Админка не должна использовать публичный navigation/header сайта.

---

# 23. Структура SMU Admin

```text
Dashboard

Контент
├── Статьи
├── Категории
├── Теги
├── Авторы
├── Страницы
├── Медиа
└── Главная страница

Наука
├── Ученые
├── Организации
├── Научные направления
├── Публикации
├── Проекты
└── Исследования

Наставничество
├── Наставники
├── Темы
├── Заявки
└── Активные пары

Research Program
├── Проекты
├── Участники
├── Заявки
└── Результаты

Поддержка
├── IT requests
├── Publication support
└── Research proposals

Возможности
├── Гранты
├── Конференции
├── Стажировки
├── Конкурсы
└── Open Calls

События

Партнеры

Пользователи
├── Пользователи
├── Роли
└── Доступы

Система
├── Настройки
├── Справочники
├── Audit log
└── Удаленные записи
```

---

# 24. Admin Dashboard

Показывать реальные данные.

Пример:

```text
Всего ученых
Ожидают верификации

Активные исследования
Активные проекты

Новые заявки наставничества
Новые Research Program applications

Новые research proposals
Новые IT requests

Черновики статей
Статьи на review
Запланированные публикации

Предстоящие события
Истекающие возможности
```

Дополнительно:

```text
Последние действия
Мои черновики
Материалы, ожидающие моей проверки
```

---

# 25. Роли

Не использовать только:

```text
user/admin
```

Создать нормальный RBAC.

Базовые роли:

```text
user
scientist
author
editor
scientific_reviewer
content_manager
scientist_manager
project_manager
admin
super_admin
```

Один пользователь может иметь несколько ролей.

---

# 26. Таблицы ролей

```sql
roles

id uuid
code text unique
name text
```

```sql
user_roles

user_id uuid
role_id uuid

unique(user_id, role_id)
```

При необходимости позже:

```sql
permissions
role_permissions
```

---

# 27. Permissions layer

Проверки доступа не писать вручную в каждом компоненте.

Создать единый permissions layer.

Примеры:

```ts
canAccessAdmin()
canCreateArticle()
canEditArticle()
canReviewArticle()
canPublishArticle()
canDeleteArticle()

canEditScientist()
canVerifyScientist()

canManageProjects()
canManageResearch()
canManageMentorship()

canManageUsers()
canManageSettings()
```

Проверка выполняется server-side.

Скрытие кнопки в UI не считается контролем доступа.

---

# 28. Пример доступа к статьям

### author

```text
создает draft
редактирует собственный draft
отправляет на review
не публикует
```

### editor

```text
создает статьи
редактирует статьи
возвращает на доработку
редактирует категории/теги
может approve при соответствующем permission
```

### scientific_reviewer

```text
видит материалы, назначенные ему
оставляет review
approve / request changes
```

### content_manager

```text
управляет всем editorial content
может публиковать
```

### admin

```text
полный операционный доступ
кроме системных функций super_admin
```

### super_admin

```text
роли
permissions
critical settings
purge
```

---

# 29. RLS

Supabase RLS обязателен.

Public content:

```text
status = 'published'
AND published_at <= now()
AND deleted_at IS NULL
```

Draft content:

```text
только пользователи с разрешением
```

Не полагаться только на Next.js middleware.

Authorization должна защищаться на двух уровнях:

```text
Application permissions
+
Supabase RLS
```

---

# 30. Audit log

```sql
audit_logs

id uuid
user_id uuid

entity_type text
entity_id uuid

action text

old_data jsonb nullable
new_data jsonb nullable

created_at timestamptz
```

Логировать как минимум:

```text
publish article
unpublish article
restore revision
delete
restore
scientist verification
project status change
application decision
role change
settings change
```

---

# 31. Soft delete

Для важных сущностей:

```text
deleted_at timestamptz nullable
```

В UI использовать:

```text
Удалить → переместить в удаленные
Восстановить
```

Физическое удаление (`purge`) доступно только ограниченной роли.

---

# 32. Научный каталог

## scientists

Основные данные:

```text
id
slug
profile_id

full_name
photo_media_id

academic_degree
academic_title
position
organization_id
city

bio

verification_status

open_for_collaboration
open_for_mentoring
open_for_media
open_for_students
open_for_projects
looking_for_students
open_for_coauthoring
open_for_reviewing
open_for_consulting
open_for_project_supervision

is_public

created_at
updated_at
deleted_at
```

---

# 33. Scientist links

```sql
scientist_links

id
scientist_id
type
url
```

type:

```text
orcid
google_scholar
scopus
researchgate
linkedin
website
```

---

# 34. Scientific publications

Это публикации ученого в научных журналах, а не CMS-статьи сайта.

```sql
publications

id
scientist_id

title
year
journal
doi
url
publication_type

created_at
updated_at
deleted_at
```

Не смешивать таблицы:

```text
publications
articles
```

`publications` = научные публикации.

`articles` = редакционные материалы сайта СМУ.

---

# 35. Organizations

```sql
organizations

id
slug
type
website
logo_media_id
city

created_at
updated_at
deleted_at
```

Переводы хранить отдельно.

Типы:

```text
university
research_center
hospital
company
government
ngo
school
other
```

---

# 36. Research fields

Поддержать иерархию.

```sql
research_fields

id
parent_id nullable
slug

created_at
updated_at
```

Translations:

```text
research_field_translations
```

---

# 37. Projects

Использовать общую таблицу для научных проектов.

```sql
projects

id
slug

type
status

lead_scientist_id
organization_id nullable

start_date
end_date

is_public

created_at
updated_at
deleted_at
```

Translations:

```text
project_translations
```

type:

```text
regional_research
research_program
scientific_project
student_project
```

---

# 38. Project members

```sql
project_members

id
project_id
profile_id
scientist_id nullable

role
contribution
status

joined_at
left_at
```

---

# 39. Research proposals

```sql
research_proposals

id
submitted_by

title
description
importance

region
available_data

organization
contact

status

created_at
updated_at
```

---

# 40. IT requests

```sql
it_requests

id
submitted_by
scientist_id nullable

title
research_description
current_process
desired_solution
data_description

status
priority

assigned_to nullable

created_at
updated_at
deleted_at
```

---

# 41. Opportunities

```sql
opportunities

id
slug
type

organization
country
deadline
funding

source_url

status
published_at

created_at
updated_at
deleted_at
```

Translations:

```text
opportunity_translations
```

Типы:

```text
grant
conference
internship
competition
open_call
scholarship
other
```

---

# 42. Events

```sql
events

id
slug

type
status

starts_at
ends_at
timezone

venue
city
online_url

cover_media_id

registration_url
registration_deadline

created_at
updated_at
deleted_at
```

Translations:

```text
event_translations
```

---

# 43. Научное наставничество

Система должна поддерживать:

```text
mentor
consultant
project_supervisor
coauthor
reviewer
research_program_mentor
```

Ключевые таблицы:

```text
mentorship_topics
mentorship_applications
mentorship_relations
```

Статусы темы:

```text
draft
open
matching
in_progress
completed
archived
```

Статусы заявки:

```text
submitted
reviewing
interview
accepted
rejected
withdrawn
```

Статусы отношения:

```text
active
paused
completed
cancelled
```

---

# 44. Научное наследие

Раздел:

```text
/mentorship/legacy
```

Хранить:

- темы;
- архивы исследований;
- неопубликованные данные;
- старые наборы данных;
- методики;
- коллекции;
- незавершенные исследования;
- научные школы;
- темы, которым нужен продолжатель.

Исходные данные не публикуются без явного разрешения владельца.

---

# 45. Личный кабинет

URL:

```text
/account
```

Разделы:

```text
Профиль
Научный профиль
Мои проекты
Мои заявки
Наставничество
Мои темы исследований
Мои ученики / наставники
Research Program
IT requests
Publication requests
Мои статьи
Уведомления
Настройки
```

Если пользователь имеет роль автора, он может работать с собственными материалами либо через ограниченный `/account/articles`, либо через `/admin`, если имеет право `canAccessAdmin`.

Предпочтительно не дублировать редактор в двух местах.

---

# 46. Frontend routing

Рекомендуемая структура:

```text
src/
├── app/
│   ├── [locale]/
│   │   ├── page.tsx
│   │   ├── scientists/
│   │   ├── organizations/
│   │   ├── research/
│   │   ├── mentorship/
│   │   ├── research-program/
│   │   ├── support/
│   │   ├── journal/
│   │   ├── opportunities/
│   │   ├── events/
│   │   ├── about/
│   │   └── account/
│   │
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── content/
│   │   │   ├── articles/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/
│   │   │   │   └── [id]/
│   │   │   ├── categories/
│   │   │   ├── tags/
│   │   │   ├── authors/
│   │   │   ├── pages/
│   │   │   ├── media/
│   │   │   └── homepage/
│   │   ├── scientists/
│   │   ├── organizations/
│   │   ├── research/
│   │   ├── projects/
│   │   ├── mentorship/
│   │   ├── research-program/
│   │   ├── opportunities/
│   │   ├── events/
│   │   ├── users/
│   │   ├── settings/
│   │   └── audit/
│   │
│   └── api/
│
├── components/
│   ├── layout/
│   ├── navigation/
│   ├── scientists/
│   ├── projects/
│   ├── mentorship/
│   ├── articles/
│   ├── editor/
│   ├── media/
│   ├── admin/
│   ├── forms/
│   └── ui/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── permissions/
│   ├── validation/
│   ├── i18n/
│   ├── search/
│   ├── seo/
│   └── editor/
│
├── server/
│   ├── services/
│   ├── repositories/
│   ├── actions/
│   └── queries/
│
└── types/
    ├── database.types.ts
    └── domain/
```

---

# 47. Admin UI principles

Административная панель должна быть удобной для людей, не являющихся разработчиками.

Основные паттерны:

```text
sidebar
topbar
breadcrumbs
data tables
filters
search
bulk actions
status badges
forms
tabs
drawers
dialogs
toast notifications
```

Не делать админку как набор «сырых CRUD-форм».

Каждая сущность должна иметь удобный workflow.

---

# 48. Таблица статей в админке

URL:

```text
/admin/content/articles
```

Колонки:

```text
Заголовок
Язык
Тип
Автор
Статус
Категории
Обновлено
Дата публикации
```

Фильтры:

```text
status
author
type
category
locale
published date
```

Действия:

```text
Открыть
Дублировать
Предпросмотр
Отправить на review
Опубликовать
Снять с публикации
Архивировать
Удалить
```

Поддержать bulk actions там, где они безопасны.

---

# 49. Экран редактирования статьи

Пример layout:

```text
┌───────────────────────────────────────────────────────────┐
│ ← Статьи          Заголовок                 [Предпросмотр] │
│                                      [Сохранить] [Review] │
├───────────────────────────────────────┬───────────────────┤
│                                       │ Статус            │
│ Заголовок                             │ Автор             │
│ Подзаголовок                          │ Категории         │
│                                       │ Теги              │
│ [ Editor ]                            │ Обложка           │
│                                       │ Связанные объекты │
│                                       │ SEO               │
│                                       │ Publish settings  │
└───────────────────────────────────────┴───────────────────┘
```

Desktop-first для admin, но интерфейс должен оставаться usable на планшете.

---

# 50. Поиск

Глобальный публичный поиск:

```text
/search?q=
```

Ищет:

```text
ученых
организации
проекты
исследования
статьи
возможности
события
```

На MVP:

```text
PostgreSQL Full Text Search
```

Позже можно заменить поисковый слой без изменения доменной модели.

---

# 51. Admin search

Отдельный глобальный поиск внутри `/admin`.

Например:

```text
Иванов
```

должен позволить быстро найти:

```text
ученого
пользователя
статью
проект
заявку
```

---

# 52. Notifications

```sql
notifications

id
user_id
type
title
message
url
read_at
created_at
```

Примеры:

```text
статья отправлена на review
review завершен
нужны изменения
статья опубликована
новая mentorship application
новая IT request
новая research proposal
```

MVP:

```text
in-app + email
```

---

# 53. Validation

Использовать Zod.

Примеры:

```text
ScientistProfileSchema
ProjectSchema
ResearchProposalSchema
ItRequestSchema
ApplicationSchema
ArticleSchema
ArticleTranslationSchema
MediaAssetSchema
OpportunitySchema
EventSchema
```

Схемы должны переиспользоваться между UI и server-side logic там, где это разумно.

---

# 54. Security

Обязательные требования:

```text
не отдавать SUPABASE_SERVICE_ROLE_KEY клиенту
server-side permission checks
RLS
Zod validation
rate limiting для публичных forms
CSRF-safe patterns
sanitization HTML
file type validation
file size limits
restricted admin routes
audit logs
```

Если editor генерирует HTML, вывод должен быть безопасно sanitized.

---

# 55. Supabase clients

Разделить:

```text
browser client
server client
admin/service-role client
```

Service role разрешен только server-side.

Не импортировать service-role client в shared/client modules.

---

# 56. Database types

Типы БД генерировать:

```text
src/types/database.types.ts
```

После изменения schema обновлять типы.

Не создавать вручную несвязанные дубликаты типов Supabase, если они могут быть выведены из generated database types.

---

# 57. Environment variables

Минимально:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

NEXT_PUBLIC_APP_URL

DATABASE_URL

RESEND_API_KEY

NEXT_PUBLIC_POSTHOG_KEY
```

Набор может расширяться.

Никогда не использовать public prefix для secret values.

---

# 58. Аналитика

Предусмотреть события:

```text
article_view
article_share
scientist_profile_view
project_view
opportunity_click
event_registration_click
research_proposal_started
research_proposal_submitted
it_request_submitted
mentorship_application_submitted
```

Не хранить лишние персональные данные ради аналитики.

---

# 59. Article analytics

Для редакции желательно видеть:

```text
просмотры
источник перехода
среднее время чтения
дочитывания
переходы к профилям ученых
переходы к связанным проектам
share clicks
```

Не делать сложную собственную аналитику на MVP, если это уже дает подключенный analytics provider.

---

# 60. Кэширование

Публичные страницы должны использовать преимущества Next.js.

Для контента:

```text
revalidate
tags
on-demand revalidation
```

После публикации / обновления материала инвалидировать соответствующие routes/tags.

Не ждать общего TTL, если редактор только что опубликовал статью.

---

# 61. Publishing hooks

После публикации статьи:

```text
1. сохранить статус
2. записать revision
3. записать audit log
4. invalidate cache
5. обновить sitemap/feed при необходимости
6. отправить уведомление
```

Логику не размазывать по UI-компонентам.

Создать:

```text
ArticleService.publish()
```

---

# 62. Repository examples

```text
ArticleRepository
ArticleRevisionRepository
MediaRepository
ScientistRepository
ProjectRepository
OpportunityRepository
EventRepository
```

Services:

```text
ArticleService
PublishingService
MediaService
ScientistService
MentorshipService
ResearchProgramService
```

---

# 63. API / Server Actions

Для внутренних CRUD-операций предпочтительно использовать Server Actions там, где это удобно.

Route Handlers использовать для:

```text
webhooks
external integrations
public API
file callbacks
cron
feeds
```

Не создавать REST API на каждую внутреннюю admin-операцию без необходимости.

---

# 64. Scheduled publishing

Создать endpoint:

```text
/api/cron/publish-scheduled
```

Он:

```text
находит status='scheduled'
AND scheduled_at <= now()
```

и публикует через service layer.

Endpoint должен быть защищен secret.

---

# 65. Справочники

Вместо hardcode в компонентах создать справочники там, где значения могут расширяться.

Пример:

```text
article_types
opportunity_types
event_types
organization_types
research_result_types
```

Если значение фундаментально и редко меняется, допустим enum.

---

# 66. Настройки

Создать:

```sql
app_settings

key text primary key
value jsonb
updated_by uuid
updated_at timestamptz
```

Использовать только для глобальных настроек.

Не превращать `app_settings` в свалку данных.

---

# 67. Content settings

Примеры:

```text
site_name
default_locale
contact_email
social_links
journal_settings
default_seo
```

---

# 68. Публичный журнал

Рекомендуемые URL:

```text
/[locale]/journal
/[locale]/journal/[slug]
/[locale]/journal/category/[slug]
/[locale]/journal/tag/[slug]
/[locale]/authors/[slug]
```

Не привязывать публичный URL к названию CMS-таблицы `/articles`, чтобы позднее можно было использовать бренд вроде:

```text
Журнал СМУ
Наука просто
SMU Science
```

без миграции архитектуры.

---

# 69. Карточка статьи

```text
Обложка
Категория
Заголовок
Excerpt
Автор
Дата
Время чтения
```

Время чтения вычислять автоматически.

---

# 70. Страница статьи

Порядок:

```text
breadcrumbs
category/type
title
subtitle
author(s)
published date
reading time
cover
content
sources/references
related scientists
related research/projects
tags
author block
related articles
share controls
```

---

# 71. Editorial relationships

Особенно важно для СМУ:

```text
Статья
  ↕
Ученый
  ↕
Исследование
  ↕
Проект
  ↕
Публикация
```

Сайт должен превращаться в связанную базу научной активности региона.

Пример:

```text
Статья: "Что происходит с родниками Актюбинской области?"
      ↓
Research project: "Атлас родников"
      ↓
Lead scientist
      ↓
Research field: Hydrogeology
      ↓
Dataset / report
      ↓
Related articles
```

---

# 72. Админка ученых

URL:

```text
/admin/scientists
```

Поддержать:

```text
создание
редактирование
верификацию
merge duplicate profiles
public/private
связь с user account
научные направления
внешние профили
публикации
наставничество
```

---

# 73. Верификация ученого

Статусы:

```text
unverified
pending
verified
rejected
```

Действие verification обязательно попадает в audit log.

---

# 74. Admin projects

Проект должен иметь:

```text
status
lead
members
research field
timeline
results
articles
files
related publications
```

Связанные статьи выбираются из CMS, а не копируются текстом.

---

# 75. Research results

Для долговременных результатов исследований предусмотреть отдельные структурированные сущности, а не только статьи.

Например:

```text
dataset
report
map
atlas
methodology
recommendation
publication
dashboard
software
archive
```

CMS-статья является способом рассказать о результате, но не заменяет сам результат.

---

# 76. File architecture

Рекомендуемая структура доменной логики:

```text
server/
├── repositories/
│   ├── articles.repository.ts
│   ├── media.repository.ts
│   ├── scientists.repository.ts
│   └── ...
│
├── services/
│   ├── articles.service.ts
│   ├── publishing.service.ts
│   ├── media.service.ts
│   ├── scientists.service.ts
│   └── ...
│
├── actions/
│   ├── articles.actions.ts
│   └── ...
│
└── queries/
    ├── public-articles.query.ts
    ├── admin-articles.query.ts
    └── ...
```

---

# 77. UI components

Не создавать огромные универсальные компоненты.

Пример:

```text
components/
├── editor/
│   ├── ArticleEditor.tsx
│   ├── EditorToolbar.tsx
│   ├── MediaPicker.tsx
│   ├── ScientistEmbed.tsx
│   └── ProjectEmbed.tsx
│
├── admin/
│   ├── AdminSidebar.tsx
│   ├── AdminHeader.tsx
│   ├── StatusBadge.tsx
│   ├── DataTable.tsx
│   └── EntityPicker.tsx
│
└── articles/
    ├── ArticleCard.tsx
    ├── ArticleHeader.tsx
    ├── ArticleContent.tsx
    └── RelatedArticles.tsx
```

---

# 78. Миграции

Каждая feature должна включать migration.

Пример:

```text
001_profiles.sql
002_scientists.sql
003_research_fields.sql
004_projects.sql
005_articles.sql
006_article_translations.sql
007_article_categories.sql
008_media_assets.sql
009_article_revisions.sql
010_roles_permissions.sql
```

Имена могут отличаться, главное — последовательность и воспроизводимость.

---

# 79. Seed

Seed должен содержать только безопасные системные данные:

```text
roles
article types
opportunity types
event types
initial categories
system settings
```

Не использовать production-like mock data в production.

---

# 80. CI/CD

На каждом pull request / deployment:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Migrations должны выполняться контролируемо.

Не выполнять destructive migration автоматически без проверки.

---

# 81. Тестирование

Минимально покрыть:

```text
permissions
article workflow
publishing
scheduled publishing
slug uniqueness
translations
RLS-sensitive operations
scientist verification
application status changes
```

---

# 82. Slug

Slug должен быть:

```text
unique
lowercase
URL-safe
```

После публикации автоматическое изменение slug из-за изменения title запрещено.

Если slug меняется вручную после публикации, предусмотреть redirect history:

```sql
slug_redirects

id
entity_type
entity_id
old_slug
new_slug
created_at
```

---

# 83. Формы

Публичные формы:

```text
присоединиться
предложить исследование
IT request
mentorship application
Research Program application
contact
```

Обязательны:

```text
validation
rate limit
anti-spam
clear consent where needed
server-side processing
```

---

# 84. Email

Для transactional email использовать provider abstraction.

Пример:

```text
EmailService
```

Текущий provider может быть Resend.

Не вызывать SDK Resend напрямую по всему проекту.

---

# 85. Что НЕ делать

Codex не должен:

1. подключать WordPress;
2. подключать Directus/Strapi/Sanity как отдельную CMS без отдельного решения;
3. создавать вторую независимую БД для CMS;
4. хранить content только как raw HTML;
5. делать произвольный page builder на MVP;
6. хранить все permissions только в frontend;
7. обходить Supabase RLS;
8. использовать service role в браузере;
9. физически удалять ключевые сущности из обычного admin UI;
10. дублировать ученых, проекты и исследования внутри CMS-текста вместо связей;
11. смешивать научные публикации (`publications`) со статьями сайта (`articles`);
12. писать собственный rich-text editor с нуля;
13. размещать всю business logic в React components;
14. создавать CRUD без audit log для критичных административных действий.

---

# 86. MVP админки

Первый этап административной панели:

```text
/admin
/admin/content/articles
/admin/content/articles/new
/admin/content/articles/[id]
/admin/content/categories
/admin/content/tags
/admin/content/authors
/admin/content/media
/admin/scientists
/admin/organizations
/admin/research
/admin/projects
/admin/opportunities
/admin/events
/admin/users
/admin/audit
```

На первом этапе CMS должна полностью позволять вести журнал/блог без участия разработчика.

---

# 87. MVP CMS — обязательные функции

```text
создать статью
сохранить draft
автосохранение
RU/KK версии
rich text editor
загрузить/выбрать изображение
обложка
авторы
категории
теги
связанные ученые
связанные проекты
SEO
preview
review
publish
unpublish
scheduled publish
revision history
soft delete
audit log
```

---

# 88. Второй этап Admin

После CMS:

```text
ученые
верификация ученых
организации
проекты
исследования
Research Program
наставничество
opportunities
events
applications
IT requests
publication support
```

---

# 89. Третий этап

Позже:

```text
editorial calendar
advanced analytics
automatic related content
newsletter
notifications
Telegram publication
social media helpers
AI-assisted tagging
AI-assisted summaries
AI-assisted translation drafts
research data catalog
regional scientific map
```

AI-функции должны быть помощниками редактора, а не автоматически публиковать материалы без контроля человека.

---

# 90. Приоритет проекта

При споре между функциями:

```text
1. Каталог ученых
2. Собственная админка / CMS
3. Научное наставничество
4. Исследовательские проекты
5. Research Program
6. IT для ученых
7. Поддержка публикаций
8. Возможности
9. PUS / Журнал
10. Новости фонда
```

При этом CMS является инфраструктурным компонентом и обслуживает несколько направлений одновременно.

---

# 91. Ключевой продуктовый принцип

Каждая новая функция должна отвечать хотя бы на один вопрос:

```text
Как это помогает ученому?
Как это помогает исследованию?
Как это помогает региону?
Как это помогает популяризации науки?
Как это помогает фиксировать и распространять научный результат?
```

---

# 92. Итоговая архитектура

```text
                              SMU Platform
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
      Public Site              User Account             SMU Admin
          │                        │                        │
          │                        │                ┌───────┼────────┐
          │                        │                │       │        │
      Scientists                Profile          CMS    Science   Operations
      Research                  Projects          │       │        │
      Mentorship                Requests       Articles Scientists Requests
      Research Program          Mentorship     Media    Projects  Users
      Opportunities             Articles       Pages    Research  Settings
      Events                                     SEO     Mentors
      Journal
          │
          └────────────────────────┬────────────────────────┘
                                   │
                                Services
                                   │
                              Repositories
                                   │
                                Supabase
                    PostgreSQL + Auth + Storage + RLS
```

---

# 93. Результат

После реализации сайт должен стать не просто страницей общественного фонда, а **единым цифровым пространством научного сообщества Актюбинской области**.

Ключевое отличие новой архитектуры:

> Контент, ученые, исследования и проекты не существуют отдельно друг от друга.

CMS должна позволять редакции рассказывать о научной деятельности, используя структурированные данные самой платформы.

Пример:

```text
Ученый
   ↓
Исследовательский проект
   ↓
Полученный результат
   ↓
Научная публикация
   ↓
Статья для широкой аудитории
   ↓
Профиль ученого / проекта автоматически показывает эту связь
```

Именно эта связность должна стать фундаментом архитектуры SMU.

---

# 94. Инструкции Codex

При реализации:

1. Не менять архитектуру без явной причины.
2. Server Components использовать по умолчанию.
3. Client Components добавлять только при необходимости интерактивности.
4. Доступ к Supabase изолировать через repository/service layer.
5. Все permissions проверять server-side.
6. Использовать RLS.
7. Использовать Zod для входных данных.
8. Использовать soft delete для важных сущностей.
9. Все критичные действия писать в audit log.
10. Не использовать production mock data.
11. Все ключевые сущности должны иметь centralized types/constants.
12. Поддерживать responsive public UI.
13. Admin UI проектировать прежде всего для desktop/tablet.
14. Поддерживать RU/KK с архитектурной возможностью EN.
15. Не хранить service-role key на клиенте.
16. Не создавать отдельную CMS-базу.
17. Не подключать external CMS без отдельного архитектурного решения.
18. CMS должна работать на тех же сущностях и связях, что и весь SMU.
19. Не смешивать editorial articles с scientific publications.
20. Любая публичная статья должна иметь возможность связи с учеными, проектами и исследованиями.

---

# 95. Первая задача Codex после принятия архитектуры

Реализацию новой CMS начать с foundations:

```text
1. RBAC / permissions foundation
2. admin layout
3. media_assets + Storage integration
4. articles
5. article_translations
6. article categories / tags
7. TipTap editor
8. article workflow
9. article revisions
10. preview
11. publishing
12. public journal
13. entity relationships
14. SEO
15. audit log
```

Не начинать с красивого dashboard до появления рабочих CRUD/workflow основных сущностей.

---

**Файл предназначен как архитектурная спецификация для Codex.**
