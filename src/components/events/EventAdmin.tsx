import { ArrowLeft, Calendar, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EventForm } from "./EventForm";
import { canViewMedia } from "@/lib/permissions/permissions";
import {
  canChangeEventStatus,
  canManageEvents,
  eventAdminPath,
  eventDate,
  eventFormatLabels,
  eventKindLabels,
  eventStatusLabels,
} from "@/lib/events";
import { eventListFiltersSchema } from "@/lib/validation/event";
import { changeEventStatus, deleteEvent, saveEvent } from "@/server/actions/event.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { EventService } from "@/server/services/event.service";
import { MediaService } from "@/server/services/media.service";
import { eventStatuses, type EventStatus } from "@/types/domain/event";

export type EventAdminSearch = Promise<{
  q?: string;
  status?: string;
  error?: string;
  deleted?: string;
  created?: string;
  saved?: string;
  status_changed?: string;
}>;

const errors: Record<string, string> = {
  validation:
    "Проверьте обязательные RU/KK-поля, время начала и окончания, место проведения и ссылки. Дедлайн регистрации должен быть не позже начала.",
  forbidden: "Недостаточно прав для этого действия.",
  invalid_reference:
    "Обложка недоступна или отсутствует одна из языковых версий. Выберите готовое публичное изображение.",
  invalid_location: "Укажите место проведения для обеих языковых версий.",
  invalid_transition: "Это изменение статуса недоступно.",
  not_found: "Событие больше недоступно.",
  confirm_delete: "Подтвердите удаление события, отметив флажок.",
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
  const parsed = eventListFiltersSchema.safeParse({
    query: state.q ?? "",
    status: state.status ?? "all",
  });
  const filters = parsed.success ? parsed.data : eventListFiltersSchema.parse({});
  const events = await new EventService().list(access.access, filters);

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/admin">Панель управления</Link>
        <span>/</span>
        <span>Программы</span>
        <span>/</span>
        <strong>События</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Научное сообщество</p>
          <h1>События</h1>
          <p>Конференции, семинары, практикумы и встречи региона.</p>
        </div>
        <div className="heading-actions">
          <Link className="primary-button" href={eventAdminPath + "/new"}>
            <Plus size={16} aria-hidden="true" />
            Добавить событие
          </Link>
        </div>
      </div>

      {state.deleted === "1" ? (
        <div className="notice success-notice">Событие перенесено в удалённые.</div>
      ) : null}
      {state.created === "1" ? (
        <div className="notice success-notice">Событие успешно создано (черновик).</div>
      ) : null}
      {state.saved === "1" ? (
        <div className="notice success-notice">Изменения события сохранены.</div>
      ) : null}
      {state.status_changed === "1" ? (
        <div className="notice success-notice">Статус события обновлён.</div>
      ) : null}
      {state.error ? (
        <div role="alert" className="notice error-notice">
          {errorMessage(state.error)}
        </div>
      ) : null}

      <section className="media-toolbar">
        <form action={eventAdminPath} className="media-filters">
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="visually-hidden">Поиск по названию</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.query}
              placeholder="Поиск по названию или организатору"
              maxLength={120}
            />
          </label>
          <select name="status" defaultValue={filters.status} aria-label="Статус">
            <option value="all">Все статусы</option>
            {eventStatuses.map((status) => (
              <option key={status} value={status}>
                {eventStatusLabels[status]}
              </option>
            ))}
          </select>
          <button className="secondary-button" type="submit">
            Применить
          </button>
        </form>
        <span className="real-count">
          {events.length} {events.length === 1 ? "событие" : events.length > 1 && events.length < 5 ? "события" : "событий"} · до 100 последних
        </span>
      </section>

      <section className="data-panel">
        <div className="data-panel-header">
          <div>
            <h2>Каталог событий</h2>
            <p>Отменённые события остаются на сайте с отметкой об отмене. Время — по Актобе (UTC+05:00).</p>
          </div>
        </div>

        {events.length ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Название и организатор</th>
                  <th>Тип и формат</th>
                  <th>Начало</th>
                  <th>Статус</th>
                  <th>Публичная страница</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const ru = event.translations.find((item) => item.locale === "ru");
                  const title = ru?.title ?? "Без названия";
                  const organizer = ru?.organizer;
                  const location = ru?.location;

                  return (
                    <tr key={event.id}>
                      <td>
                        <Link href={eventAdminPath + "/" + event.id} style={{ fontWeight: 600 }}>
                          {title}
                        </Link>
                        {organizer ? (
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                            {organizer}
                            {location ? ` · ${location}` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>
                            {eventKindLabels.ru[event.kind]}
                          </span>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {eventFormatLabels.ru[event.format]}
                          </span>
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                        {eventDate(event.startsAt, "ru")}
                      </td>
                      <td>
                        <span className={"status-badge status-" + event.status}>
                          {eventStatusLabels[event.status]}
                        </span>
                      </td>
                      <td>
                        {event.status === "published" || event.status === "cancelled" ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            {event.translations.map((t) => (
                              <Link
                                key={t.locale}
                                href={`/${t.locale}/events/${t.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="button-link"
                                style={{
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  color: "var(--forest-bright)",
                                }}
                              >
                                <span>{t.locale.toUpperCase()}</span>
                                <ExternalLink size={11} aria-hidden="true" />
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Calendar
              size={48}
              strokeWidth={1.5}
              aria-hidden="true"
              style={{ color: "#94a3b8", marginBottom: "12px" }}
            />
            <h3>События не найдены</h3>
            <p>Добавьте первое событие или измените параметры поиска.</p>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "center" }}>
              <Link className="secondary-button" href={eventAdminPath}>
                Сбросить фильтры
              </Link>
              <Link className="primary-button" href={eventAdminPath + "/new"}>
                <Plus size={16} aria-hidden="true" />
                Добавить событие
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export async function EventAdminEditor({
  id,
  searchParams,
}: {
  id?: string;
  searchParams: EventAdminSearch;
}) {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageEvents(access.access)) notFound();
  if (id && !z.uuid().safeParse(id).success) notFound();

  const event = id ? await new EventService().getById(access.access, id) : undefined;
  if (id && !event) notFound();

  const [state, media] = await Promise.all([
    searchParams,
    canViewMedia(access.access)
      ? new MediaService()
          .list(access.access, { query: "", type: "image" })
          .then((items) =>
            items.filter((item) => ["article-media", "event-media"].includes(item.storageBucket))
          )
      : Promise.resolve([]),
  ]);

  if (
    event?.coverMediaId &&
    canViewMedia(access.access) &&
    !media.some((item) => item.id === event.coverMediaId)
  ) {
    const current = await new MediaService().getById(access.access, event.coverMediaId);
    if (current && !current.asset.deletedAt) media.push(current.asset);
  }

  const ruTitle = event?.translations.find((item) => item.locale === "ru")?.title;

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/admin">Панель управления</Link>
        <span>/</span>
        <Link href={eventAdminPath}>События</Link>
        <span>/</span>
        <strong>{ruTitle ?? "Новое событие"}</strong>
      </nav>

      <Link className="back-link" href={eventAdminPath}>
        <ArrowLeft size={16} aria-hidden="true" />
        Все события
      </Link>

      <div className="media-detail-heading">
        <div>
          <p className="page-kicker">События региона</p>
          <h1>{ruTitle ?? "Новое событие"}</h1>
          <p>
            Сохранение создаёт черновик. Публикуйте событие после проверки обеих языковых версий
            (RU и KK; EN — по желанию).
          </p>
        </div>
        {event ? (
          <span className={"status-badge status-" + event.status}>
            {eventStatusLabels[event.status]}
          </span>
        ) : null}
      </div>

      {state.error ? (
        <div className="notice error-notice" role="alert">
          {errorMessage(state.error)}
        </div>
      ) : null}
      {state.created === "1" || state.saved === "1" ? (
        <div className="notice success-notice">Черновик сохранён.</div>
      ) : null}
      {state.status_changed === "1" ? (
        <div className="notice success-notice">Статус обновлён.</div>
      ) : null}

      {event ? (
        <section className="workflow-panel">
          <div>
            <h2>Текущий статус: {eventStatusLabels[event.status]}</h2>
            <p>
              Отмена сохраняет публичную страницу с отметкой об отмене и закрывает регистрацию.
              Правки возвращают событие в черновики.
            </p>
            {event.status === "published" || event.status === "cancelled" ? (
              <div className="heading-actions" style={{ marginTop: "8px" }}>
                {event.translations.map((item) => (
                  <Link
                    key={item.locale}
                    href={"/" + item.locale + "/events/" + item.slug}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    <span>Открыть {item.locale.toUpperCase()}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="workflow-actions">
            {eventStatuses
              .filter((status) => canChangeEventStatus(event.status, status))
              .map((status) => (
                <form key={status} action={changeEventStatus.bind(null, event.id, status)}>
                  <SubmitWorkflowButton status={status} />
                </form>
              ))}
          </div>
        </section>
      ) : null}

      <EventForm
        action={saveEvent.bind(null, event?.id ?? null)}
        event={event ?? undefined}
        media={media}
      />

      {event ? (
        <section className="danger-zone" style={{ marginTop: "24px" }}>
          <div>
            <h2>Перенести в удалённые</h2>
            <p>Событие исчезнет из панели управления и публичного каталога.</p>
          </div>
          <form action={deleteEvent.bind(null, event.id)}>
            <label className="confirm-check">
              <input type="checkbox" name="confirm" value="yes" required />
              Подтверждаю безвозвратное удаление события
            </label>
            <button className="danger-button" type="submit">
              <Trash2 size={15} aria-hidden="true" style={{ marginRight: "4px" }} />
              Удалить событие
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function SubmitWorkflowButton({ status }: { status: EventStatus }) {
  return (
    <button
      type="submit"
      className={status === "published" ? "primary-button" : "secondary-button"}
    >
      {status === "published"
        ? "Опубликовать"
        : status === "draft"
        ? "Вернуть в черновики"
        : status === "cancelled"
        ? "Отменить событие"
        : "В архив"}
    </button>
  );
}
