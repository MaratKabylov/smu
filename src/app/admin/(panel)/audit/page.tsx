import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auditFiltersSchema } from "@/lib/validation/audit";
import { getAdminAccess } from "@/server/services/access.service";
import { AuditRecordsService, canViewAudit } from "@/server/services/audit-records.service";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const dates = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });

export default async function AuditPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = auditFiltersSchema.safeParse({ entityType: params.type, action: params.action, actor: params.actor,
    entityId: params.entity, from: params.from, until: params.until, page: params.page });
  if (!parsed.success) notFound();
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed" || !canViewAudit(result.access)) notFound();
  const filters = parsed.data;
  const { records, hasNextPage } = await new AuditRecordsService().list(result.access, filters);
  const pageUrl = (page: number) => `/admin/audit?${new URLSearchParams({ type: filters.entityType, action: filters.action,
    actor: filters.actor, entity: filters.entityId, from: filters.from, until: filters.until, page: String(page) })}`;
  return <div className="content-page">
    <nav className="breadcrumbs" aria-label="Хлебные крошки"><span>Система</span><span>/</span><strong>Журнал аудита</strong></nav>
    <div className="page-heading"><div><p className="page-kicker">История операций</p><h1>Журнал аудита</h1>
      <p>Действия пользователей и автоматических процессов. Даты и время — UTC. До 50 событий на странице.</p></div></div>
    <section className="media-toolbar" aria-label="Фильтры журнала аудита">
      <form className="audit-filters" action="/admin/audit">
        <label>Тип записи<input name="type" maxLength={80} defaultValue={filters.entityType} placeholder="article, scientist…" /></label>
        <label>Действие<input name="action" maxLength={120} defaultValue={filters.action} placeholder="published, purged…" /></label>
        <label>ID пользователя<input name="actor" defaultValue={filters.actor} placeholder="UUID" /></label>
        <label>ID записи<input name="entity" defaultValue={filters.entityId} placeholder="UUID" /></label>
        <label>С даты<input type="date" name="from" defaultValue={filters.from} /></label>
        <label>По дату включительно<input type="date" name="until" defaultValue={filters.until} /></label>
        <button className="secondary-button" type="submit">Применить</button><Link className="secondary-button" href="/admin/audit">Сбросить</Link>
      </form>
    </section>
    <section className="data-panel" aria-label="События аудита">
      <div className="data-panel-header"><div><h2>События</h2><p>Показаны идентификаторы операций. Снимки содержимого и контактные данные закрыты.</p></div></div>
      {records.length ? <div className="table-wrap"><table className="articles-table audit-table">
        <thead><tr><th>Время (UTC)</th><th>Пользователь</th><th>Запись</th><th>Действие</th></tr></thead>
        <tbody>{records.map(record => <tr key={record.id}>
          <td><time dateTime={record.created_at}>{dates.format(new Date(record.created_at))}</time><small>ID события: {record.id}</small></td>
          <td>{record.user_id ? <Link href={`/admin/audit?${new URLSearchParams({ actor: record.user_id })}`}><code>{record.user_id}</code></Link> : "Автоматический процесс / удалённый аккаунт"}</td>
          <td>{record.entity_type}{record.entity_id ? <small><Link href={`/admin/audit?${new URLSearchParams({ type: record.entity_type, entity: record.entity_id })}`}><code>{record.entity_id}</code></Link></small> : null}</td>
          <td><code>{record.action}</code></td>
        </tr>)}</tbody>
      </table></div> : <div className="empty-state"><h3>События не найдены</h3><p>Измените фильтры или диапазон дат.</p></div>}
    </section>
    <nav className="heading-actions" aria-label="Страницы аудита">
      {filters.page > 1 ? <Link className="secondary-button" href={pageUrl(filters.page - 1)}>Предыдущая страница</Link> : null}
      <span>Страница {filters.page}</span>
      {hasNextPage ? <Link className="secondary-button" href={pageUrl(filters.page + 1)}>Следующая страница</Link> : null}
    </nav>
  </div>;
}
