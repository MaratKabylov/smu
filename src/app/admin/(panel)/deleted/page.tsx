import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { canDeleteArticle, canEditScientist } from "@/lib/permissions/permissions";
import { articleStatusLabels } from "@/lib/articles/presentation";
import { scientistStatusLabels } from "@/lib/scientists/presentation";
import { deletedRecordsFiltersSchema } from "@/lib/validation/deleted-records";
import { restoreDeletedRecord } from "@/server/actions/deleted-records.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { canViewDeletedRecords, DeletedRecordsService } from "@/server/services/deleted-records.service";
import type { ArticleStatus } from "@/types/domain/article";
import type { ScientistStatus } from "@/types/domain/scientist";
import { SubmitButton } from "@/components/science/SubmitButton";

type Props = { searchParams: Promise<{ kind?: string; q?: string; page?: string; error?: string; restored?: string }> };
const dates = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" });
const errors: Record<string, string> = {
  validation: "Подтвердите восстановление и обновите список.",
  forbidden: "Недостаточно прав для восстановления этой записи.",
  not_found: "Запись больше не существует. Обновите список.",
  stale_version: "Состояние записи изменилось. Обновите список перед восстановлением.",
  invalid_reference: "Восстановление остановлено: связанные медиа, справочники или научные объекты недоступны. Обратитесь к администратору для восстановления медиа, активации справочников или верификации/публикации связанных объектов, затем повторите попытку.",
  slug_reserved: "Адрес зарезервирован другой записью. Требуется проверка истории адресов администратором.",
  slug_conflict: "Адрес занят другой записью. Требуется проверка адресов администратором.",
};

export default async function DeletedRecordsPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = deletedRecordsFiltersSchema.safeParse({ kind: params.kind, query: params.q, page: params.page });
  if (!parsed.success) notFound();
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed" || !canViewDeletedRecords(result.access)) notFound();
  const filters = parsed.data;
  const articles = canDeleteArticle(result.access);
  const scientists = canEditScientist(result.access);
  if ((filters.kind === "article" && !articles) || (filters.kind === "scientist" && !scientists)) notFound();
  const { records, hasNextPage } = await new DeletedRecordsService().list(result.access, filters);
  const pageUrl = (page: number) => `/admin/deleted?${new URLSearchParams({ kind: filters.kind, q: filters.query, page: String(page) })}`;
  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки"><span>Система</span><span>/</span><strong>Удалённые записи</strong></nav>
      <div className="page-heading"><div><p className="page-kicker">Восстановление</p><h1>Удалённые записи</h1>
        <p>Статьи и профили возвращаются в черновики. Публикация и верификация выполняются заново.</p></div></div>
      {params.restored === "1" ? <div className="notice success-notice">Запись восстановлена в черновики.</div> : null}
      {params.error ? <div className="notice error-notice" role="alert">{errors[params.error] ?? "Не удалось восстановить запись. Обновите список и повторите попытку."}</div> : null}
      <section className="media-toolbar" aria-label="Фильтры удалённых записей">
        <form className="media-filters" action="/admin/deleted">
          <label className="search-field"><Search aria-hidden="true" /><span className="visually-hidden">Поиск по названию RU / KK</span>
            <input type="search" name="q" defaultValue={filters.query} maxLength={120} placeholder="Название или имя RU / KK" /></label>
          <label><span className="visually-hidden">Тип записи</span><select name="kind" defaultValue={filters.kind}>
            <option value="all">Все доступные типы</option>{articles ? <option value="article">Статьи</option> : null}{scientists ? <option value="scientist">Учёные</option> : null}
          </select></label><button className="secondary-button" type="submit">Применить</button>
        </form>
      </section>
      <section className="data-panel" aria-label="Удалённые статьи и профили">
        <div className="data-panel-header"><div><h2>Удалённые материалы</h2><p>Время удаления — Казахстан (UTC+5). До 50 записей на странице.</p></div></div>
        {records.length ? <div className="table-wrap"><table className="articles-table">
          <thead><tr><th>Название / имя</th><th>Тип</th><th>Статус до удаления</th><th>Удалено</th><th>Восстановление</th></tr></thead>
          <tbody>{records.map(record => <tr key={`${record.kind}:${record.id}`}>
            <td><span lang="ru">{record.titleRu ?? "Без названия RU"}</span><small lang="kk">{record.titleKk ?? "KK нұсқасы жоқ"}</small></td>
            <td>{record.kind === "article" ? "Статья" : "Учёный"}</td>
            <td>{record.kind === "article" ? articleStatusLabels[record.status as ArticleStatus] ?? record.status : scientistStatusLabels[record.status as ScientistStatus] ?? record.status}</td>
            <td><time dateTime={record.deletedAt}>{dates.format(new Date(record.deletedAt))}</time></td>
            <td><form action={restoreDeletedRecord}>
              <input type="hidden" name="id" value={record.id} /><input type="hidden" name="kind" value={record.kind} />
              <input type="hidden" name="expectedDeletedAt" value={record.deletedAt} />
              <label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю восстановление в черновики</label>
              <SubmitButton label="Восстановить" pendingLabel="Восстановление…" />
            </form></td>
          </tr>)}</tbody>
        </table></div> : <div className="empty-state"><span className="empty-icon"><Trash2 aria-hidden="true" /></span><h3>Удалённых записей не найдено</h3><p>Измените фильтры или вернитесь в каталог.</p></div>}
      </section>
      <nav className="heading-actions" aria-label="Страницы удалённых записей">
        {filters.page > 1 ? <Link className="secondary-button" href={pageUrl(filters.page - 1)}>Предыдущая страница</Link> : null}
        <span>Страница {filters.page}</span>
        {hasNextPage ? <Link className="secondary-button" href={pageUrl(filters.page + 1)}>Следующая страница</Link> : null}
      </nav>
    </div>
  );
}
