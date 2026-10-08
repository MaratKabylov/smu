insert into public.roles (code, name)
values
  ('user', 'Пользователь'),
  ('scientist', 'Ученый'),
  ('author', 'Автор'),
  ('editor', 'Редактор'),
  ('scientific_reviewer', 'Научный рецензент'),
  ('content_manager', 'Контент-менеджер'),
  ('scientist_manager', 'Менеджер ученых'),
  ('project_manager', 'Менеджер проектов'),
  ('admin', 'Администратор'),
  ('super_admin', 'Суперадминистратор')
on conflict (code) do update set name = excluded.name;

insert into public.permissions (code, name)
values
  ('admin.access', 'Доступ в административную панель'),
  ('articles.create', 'Создание статей'),
  ('articles.edit_own', 'Редактирование собственных статей'),
  ('articles.edit_any', 'Редактирование любых статей'),
  ('articles.review', 'Рецензирование статей'),
  ('articles.publish', 'Публикация статей'),
  ('articles.delete', 'Удаление статей'),
  ('media.view', 'Просмотр медиа-библиотеки'),
  ('media.create', 'Загрузка медиафайлов'),
  ('media.edit', 'Редактирование метаданных медиафайлов'),
  ('media.delete', 'Мягкое удаление медиафайлов'),
  ('media.purge', 'Физическое удаление медиафайлов'),
  ('scientists.edit', 'Редактирование ученых'),
  ('scientists.verify', 'Верификация ученых'),
  ('scientists.merge', 'Объединение дубликатов научных профилей'),
  ('projects.manage', 'Управление проектами'),
  ('research.manage', 'Управление исследованиями'),
  ('mentorship.manage', 'Управление наставничеством'),
  ('research_program.manage', 'Управление исследовательскими программами'),
  ('events.manage', 'Управление событиями'),
  ('publications.manage', 'Управление научными публикациями'),
  ('users.manage', 'Управление пользователями'),
  ('roles.manage', 'Управление ролями и доступами'),
  ('settings.manage', 'Управление системными настройками'),
  ('audit.read', 'Просмотр журнала аудита'),
  ('audit.write', 'Запись в журнал аудита')
on conflict (code) do update set name = excluded.name;

with grants(role_code, permission_code) as (
  values
    ('author', 'admin.access'),
    ('author', 'articles.create'),
    ('author', 'articles.edit_own'),
    ('editor', 'admin.access'),
    ('editor', 'articles.create'),
    ('editor', 'articles.edit_any'),
    ('editor', 'articles.review'),
    ('scientific_reviewer', 'admin.access'),
    ('scientific_reviewer', 'articles.review'),
    ('content_manager', 'admin.access'),
    ('content_manager', 'articles.create'),
    ('content_manager', 'articles.edit_any'),
    ('content_manager', 'articles.review'),
    ('content_manager', 'articles.publish'),
    ('content_manager', 'articles.delete'),
    ('content_manager', 'audit.read'),
    ('author', 'media.view'),
    ('author', 'media.create'),
    ('editor', 'media.view'),
    ('editor', 'media.create'),
    ('editor', 'media.edit'),
    ('content_manager', 'media.view'),
    ('content_manager', 'media.create'),
    ('content_manager', 'media.edit'),
    ('content_manager', 'media.delete'),
    ('scientist_manager', 'media.view'),
    ('scientist_manager', 'media.create'),
    ('scientist_manager', 'media.edit'),
    ('project_manager', 'media.view'),
    ('project_manager', 'media.create'),
    ('project_manager', 'media.edit'),
    ('scientist_manager', 'admin.access'),
    ('scientist_manager', 'scientists.edit'),
    ('scientist_manager', 'scientists.verify'),
    ('scientist_manager', 'scientists.merge'),
    ('scientist_manager', 'publications.manage'),
    ('scientist_manager', 'audit.read'),
    ('project_manager', 'admin.access'),
    ('project_manager', 'projects.manage'),
    ('project_manager', 'research.manage'),
    ('project_manager', 'audit.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin'
  and p.code not in ('roles.manage', 'settings.manage', 'media.purge')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
on conflict do nothing;
