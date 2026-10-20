# Миграции, резервное копирование и восстановление

Эта инструкция обязательна перед изменением рабочей Supabase-базы. SQL-миграции в
`supabase/migrations` необратимы: down-скриптов нет, поэтому откат выполняется
восстановлением проверенной резервной копии в согласованное окно обслуживания.

## Локальная проверка цепочки

```text
npm run db:migrations:verify
```

Команда не подключается к Supabase. Она в PGlite проверяет два сценария:

1. все миграции 001–042 применяются к пустой базе, после чего `seed.sql` создаёт
   актуальные роли и права;
2. заполненная схема 008 со старой опубликованной статьёй, профилем учёного,
   событием, назначенной ролью и аудитом обновляется миграциями 009–042 без
   потери содержимого, статусов, дат публикации/верификации и истории аудита.

Это дополняет модульные SQL-тесты отдельных миграций, но не заменяет репетицию
на отдельном Supabase-проекте: PGlite использует минимальные заглушки Auth и
Storage и не воспроизводит сетевые сбои, физические backup/PITR и параллельные
подключения PostgreSQL.

## Подготовка обновления

1. Зафиксируйте версию приложения, последний применённый номер миграции и список
   файлов, которые предстоит применить. В проекте нет таблицы, по которой можно
   безопасно угадать историю ручных запусков. Если журнал развёртывания неполон,
   сначала сравните схему в отдельной среде и не запускайте миграции в production.
2. Остановите административные записи и публичные формы либо включите режим
   обслуживания. Логический dump согласован внутри одной выгрузки, но новые записи
   после него не попадут в точку восстановления.
3. Проверьте доступность последней управляемой копии или PITR в Supabase Dashboard.
   Запланируйте простой: восстановление делает проект временно недоступным.
4. Создайте ручную логическую копию и выполните пробное восстановление в новый
   тестовый проект. Не проверяйте restore поверх рабочей базы.

Для миграций и backup/restore Supabase рекомендует прямое подключение Postgres;
если IPv6 недоступен, допустим session pooler на порту 5432. Transaction pooler
на 6543 для этой операции не используется. Строку подключения копируйте из
панели **Connect**, не составляйте адрес вручную.

## Ручная логическая копия

Понадобятся актуальные Supabase CLI, Docker и свободное место вне репозитория.
Каталог с копией должен быть зашифрован и доступен только операторам. Строку
подключения не записывайте в `.env`, git, логи CI или текст команды в истории.

В PowerShell задайте её только для текущего процесса и выполните официальный
трёхчастный dump:

```powershell
$env:SMU_SOURCE_DB_URL = Read-Host "Source database URL"
$smuBackupDir = "D:\secure-backups\smu-YYYYMMDD-HHMM"
New-Item -ItemType Directory -Path $smuBackupDir

supabase db dump --db-url $env:SMU_SOURCE_DB_URL -f "$smuBackupDir\roles.sql" --role-only
supabase db dump --db-url $env:SMU_SOURCE_DB_URL -f "$smuBackupDir\schema.sql"
supabase db dump --db-url $env:SMU_SOURCE_DB_URL -f "$smuBackupDir\data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

Get-FileHash "$smuBackupDir\roles.sql", "$smuBackupDir\schema.sql", "$smuBackupDir\data.sql" -Algorithm SHA256
Remove-Item Env:SMU_SOURCE_DB_URL
```

Сохраните рядом с копией, но не в git: дату UTC, project ref, версию Postgres,
последнюю миграцию, commit приложения, размеры трёх файлов и SHA-256. Ненулевой
размер и checksum подтверждают переносимость файла, но не успешность восстановления.

Database backup содержит метаданные Storage, а не сами объекты. Отдельно
экспортируйте байты закрытых и публичных buckets штатным Storage API/процессом
хранилища и свяжите этот снимок с той же датой. Иначе восстановленная БД может
ссылаться на отсутствующие файлы.

## Репетиция восстановления

Создайте отдельный Supabase-проект, включите используемые расширения и получите
его строку подключения. Убедитесь по project ref и hostname, что это не production.
Если позднее будут добавлены Vault или column encryption, используйте специальный
вариант официальной инструкции с переносом encryption root key.

```powershell
$env:SMU_RESTORE_DB_URL = Read-Host "Disposable restore database URL"
$smuBackupDir = "D:\secure-backups\smu-YYYYMMDD-HHMM"

psql --single-transaction --variable ON_ERROR_STOP=1 --file "$smuBackupDir\roles.sql" --file "$smuBackupDir\schema.sql" --command "SET session_replication_role = replica" --file "$smuBackupDir\data.sql" --dbname $env:SMU_RESTORE_DB_URL

Remove-Item Env:SMU_RESTORE_DB_URL
```

После restore:

1. Сверьте количества и контрольные записи минимум в `profiles`, `articles`,
   `article_translations`, `scientist_profiles`, `science_works`, `events`,
   `support_requests`, `audit_logs`, `notifications` и `media_assets`.
2. Проверьте максимальные `created_at`/`updated_at`, опубликованные RU/KK-записи,
   связи, роли ключевых операторов и наличие ожидаемых Storage-объектов.
3. Примените к восстановленной базе только отсутствующие миграции строго по номеру.
   На пустой базе выполняются 001–042 и затем `seed.sql`; на существующей базе
   уже применённые файлы повторно не запускаются.
4. Повторите smoke-сценарии анонимного пользователя, обычного аккаунта, admin и
   super_admin, включая RLS, загрузку/скачивание файла и оба cron endpoint.
5. Сохраните протокол: время dump/restore, длительность, checksums, применённые
   миграции, сравнение counts и результат smoke-проверок.

## Production и откат

Обновляйте production только после успешной репетиции из свежего dump. Применяйте
миграции по одной в порядке имён, фиксируйте начало/окончание и останавливайтесь
при первой ошибке. Затем разворачивайте совместимую версию приложения и выполняйте
короткий smoke без изменения лишних данных.

При ошибке не пытайтесь вручную обращать частично выполненную цепочку и не
перезапускайте вслепую уже применённый файл. Остановите записи, сохраните журналы,
определите последнюю завершённую транзакцию и восстановите проверенную копию или
PITR по согласованному runbook. После восстановления заново проверьте роли, RLS,
cron, Auth, Storage и контрольные количества. Отдельно восстановите байты Storage,
если они были удалены или заменены после точки восстановления.

Официальные источники:

- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase: выбор подключения к Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Database Backups и ограничения Storage](https://supabase.com/docs/guides/platform/backups)

