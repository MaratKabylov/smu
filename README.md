# SMU — Совет молодых ученых

Единая цифровая платформа научного сообщества Актюбинской области. Проект
строится на Next.js, TypeScript и Supabase. Публичный сайт, личный кабинет и
SMU Admin используют одну доменную модель и одну базу данных.

## Текущий этап

Реализована первая foundation-итерация:

- отдельный admin layout на `/admin`;
- Supabase Auth и разделенные browser/server/service-role клиенты;
- серверный RBAC/permissions layer;
- миграция `profiles`, `roles`, `permissions`, `user_roles`,
  `role_permissions`, `audit_logs`;
- RLS-политики и безопасный системный seed;
- экран входа и безопасное setup-состояние до подключения Supabase.

## Локальный запуск

1. Скопируйте `.env.example` в `.env.local` и заполните Supabase URL и ключи.
2. Примените `supabase/migrations/001_profiles_rbac.sql`.
3. Выполните `supabase/seed.sql`.
4. Создайте пользователя через Supabase Auth и один раз назначьте ему роль
   `super_admin` через SQL Editor:

```sql
insert into public.user_roles (user_id, role_id)
select '<auth-user-id>', id
from public.roles
where code = 'super_admin';
```

5. Запустите `npm run dev` и откройте `/admin`.

## Проверки

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

После подключения проекта Supabase типы базы следует генерировать в
`src/types/database.types.ts` после каждого изменения схемы:

```text
npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
```

Следующая итерация: `media_assets` и Storage integration, затем модели
`articles` и `article_translations`.
