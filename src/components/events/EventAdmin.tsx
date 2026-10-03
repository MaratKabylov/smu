import { ArrowLeft, Plus, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EventForm } from "./EventForm";
import { canViewMedia } from "@/lib/permissions/permissions";
import { canChangeEventStatus, canManageEvents, eventAdminPath, eventDate, eventFormatLabels, eventStatusLabels } from "@/lib/events";
import { eventListFiltersSchema } from "@/lib/validation/event";
import { changeEventStatus, deleteEvent, saveEvent } from "@/server/actions/event.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { EventService } from "@/server/services/event.service";
import { MediaService } from "@/server/services/media.service";
import { eventStatuses } from "@/types/domain/event";

export type EventAdminSearch = Promise<{ q?: string; status?: string; error?: string; deleted?: string; created?: string; saved?: string; status_changed?: string }>;
const errors: Record<string, string> = {
  validation: "Проверьте обязательные RU/KK-поля, время начала и окончания, место проведения и ссылки. Дедлайн регистрации должен быть не позже начала.",
  forbidden: "Недостаточно прав для этого действия.",
  invalid_reference: "Обложка недоступна или отсутствует одна из языковых версий. Выберите готовое публичное изображение.",
  invalid_location: "Укажите место проведения для обеих языковых версий.",
  invalid_transition: "Это изменение статуса недоступно.",
  not_found: "Событие больше недоступно.",
  confirm_delete: "Подтвердите удаление события.",
  action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug и повторите попытку.",
};
function errorMessage(code: string) {
  return Object.hasOwn(errors, code) ? errors[code] : errors.action_failed;
}
export async function EventAdminList({ searchParams }: { searchParams: EventAdminSearch }) {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageEvents(access.access)) notFound();
  const state = await searchParams;
  const parsed = eventListFiltersSchema.safeParse({ query: state.q ?? "", status: state.status ?? "all" });
  const filters = parsed.success ? parsed.data : eventListFiltersSchema.parse({});
  const events = await new EventService().list(access.access, filters);
  return <div className="content-page">
    <nav className="breadcrumbs" aria-label="Хлебные крошки"><span>Программы</span><span>/</span><strong>События</strong></nav>
    <div className="page-heading media-page-heading"><div><p className="page-kicker">Научное сообщество</p><h1>События</h1><p>Конференции, семинары, практикумы и встречи региона.</p></div><Link className="primary-button" href={eventAdminPath + "/new"}><Plus aria-hidden="true" />Добавить событие</Link></div>
    {state.deleted === "1" ? <div className="notice success-notice">Событие перенесено в удалённые.</div> : null}
    {state.error ? <div role="alert" className="notice error-notice">{errorMessage(state.error)}</div> : null}
    <section className="media-toolbar"><form action={eventAdminPath} className="media-filters"><label className="search-field"><Search aria-hidden="true" /><span className="visually-hidden">Поиск по названию</span><input type="search" name="q" defaultValue={filters.query} placeholder="Поиск по названию" maxLength={120} /></label><select name="status" defaultValue={filters.status} aria-label="Статус"><option value="all">Все статусы</option>{eventStatuses.map(status => <option key={status} value={status}>{eventStatusLabels[status]}</option>)}</select><button className="secondary-button" type="submit">Применить</button></form><span className="real-count">{events.length} событий · до 100 последних</span></section>
    <section className="data-panel"><div className="data-panel-header"><div><h2>Каталог событий</h2><p>Отменённые события остаются на сайте с отметкой об отмене. Время — по Актобе.</p></div></div>
      {events.length ? <div className="table-wrap"><table className="articles-table"><thead><tr><th>Название</th><th>Начало</th><th>Формат</th><th>Статус</th></tr></thead><tbody>{events.map(event => <tr key={event.id}><td><Link href={eventAdminPath + "/" + event.id}>{event.translations.find(item => item.locale === "ru")?.title ?? "Без названия"}</Link><small>{event.translations.find(item => item.locale === "ru")?.organizer}</small></td><td>{eventDate(event.startsAt, "ru")}</td><td>{eventFormatLabels.ru[event.format]}</td><td><span className={"status-badge status-" + event.status}>{eventStatusLabels[event.status]}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>События не найдены</h3><p>Добавьте событие или измените фильтры.</p></div>}
    </section>
  </div>;
}
export async function EventAdminEditor({ id, searchParams }: { id?: string; searchParams: EventAdminSearch }) {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageEvents(access.access)) notFound();
  if (id && !z.uuid().safeParse(id).success) notFound();
  const event = id ? await new EventService().getById(access.access, id) : undefined;
  if (id && !event) notFound();
  const [state, media] = await Promise.all([
    searchParams,
    canViewMedia(access.access) ? new MediaService().list(access.access, { query: "", type: "image" })
      .then(items => items.filter(item => ["article-media", "event-media"].includes(item.storageBucket))) : Promise.resolve([]),
  ]);
  if (event?.coverMediaId && canViewMedia(access.access) && !media.some(item => item.id === event.coverMediaId)) {
    const current = await new MediaService().getById(access.access, event.coverMediaId);
    if (current && !current.asset.deletedAt) media.push(current.asset);
  }
  return <div className="content-page">
    <Link className="back-link" href={eventAdminPath}><ArrowLeft aria-hidden="true" />События</Link>
    <div className="media-detail-heading"><div><p className="page-kicker">События</p><h1>{event?.translations.find(item => item.locale === "ru")?.title ?? "Новое событие"}</h1><p>Сохранение создаёт черновик. Публикуйте событие после проверки обеих языковых версий.</p></div>{event ? <span className={"status-badge status-" + event.status}>{eventStatusLabels[event.status]}</span> : null}</div>
    {state.error ? <div className="notice error-notice" role="alert">{errorMessage(state.error)}</div> : null}
    {state.created === "1" || state.saved === "1" ? <div className="notice success-notice">Черновик сохранён.</div> : null}
    {state.status_changed === "1" ? <div className="notice success-notice">Статус обновлён.</div> : null}
    {event ? <section className="workflow-panel"><div><h2>{eventStatusLabels[event.status]}</h2><p>Отмена сохраняет публичную страницу и закрывает регистрацию. Правки возвращают событие в черновики.</p>{event.status === "published" || event.status === "cancelled" ? <div className="heading-actions">{event.translations.map(item => <Link key={item.locale} href={"/events/" + item.locale + "/" + item.slug} target="_blank">Открыть {item.locale.toUpperCase()}</Link>)}</div> : null}</div><div className="workflow-actions">{eventStatuses.filter(status => canChangeEventStatus(event.status, status)).map(status => <form key={status} action={changeEventStatus.bind(null, event.id, status)}><SubmitWorkflowButton status={status} /></form>)}</div></section> : null}
    <EventForm action={saveEvent.bind(null, event?.id ?? null)} event={event ?? undefined} media={media} />
    {event ? <section className="danger-zone"><div><h2>Перенести в удалённые</h2><p>Событие исчезнет из админки и публичного каталога.</p></div><form action={deleteEvent.bind(null, event.id)}><label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю действие</label><button className="danger-button" type="submit">Удалить</button></form></section> : null}
  </div>;
}
function SubmitWorkflowButton({ status }: { status: (typeof eventStatuses)[number] }) {
  return <button type="submit" className={status === "published" ? "primary-button" : "secondary-button"}>{status === "published" ? "Опубликовать" : status === "draft" ? "Вернуть в черновики" : status === "cancelled" ? "Отменить событие" : "В архив"}</button>;
}
