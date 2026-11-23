import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  HandHeart,
  Layers,
  Mail,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { SubmitButton } from "@/components/science/SubmitButton";
import { MentorshipForm } from "./MentorshipForm";
import { MentorshipProgress } from "./MentorshipProgress";
import { mentorshipProgressCopy } from "@/lib/i18n/mentorship-progress";
import {
  applicationStatusLabels,
  canChangeApplicationStatus,
  canChangeMentorshipRelationStatus,
  canChangeMentorshipStatus,
  mentorshipAdminPath as base,
  mentorshipFormatLabels,
  mentorshipStatusLabels,
} from "@/lib/mentorship";
import { canManageMentorship } from "@/lib/permissions/permissions";
import {
  applicationStatusSchema,
  mentorshipStatusSchema,
} from "@/lib/validation/mentorship";
import {
  changeMentorshipOffer,
  changeMentorshipRelation,
  saveMentorshipOffer,
  updateMentorshipApplication,
} from "@/server/actions/mentorship.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { MentorshipService } from "@/server/services/mentorship.service";
import {
  applicationStatuses,
  mentorshipFormats,
  mentorshipKinds,
  mentorshipRelationStatuses,
  mentorshipStatuses,
  type MentorshipApplication,
} from "@/types/domain/mentorship";
import type { AccessContext } from "@/types/domain/auth";

export type MentorshipAdminSearch = Promise<{
  application?: string;
  status?: string;
  format?: string;
  q?: string;
  error?: string;
  saved?: string;
  created?: string;
  deleted?: string;
  application_saved?: string;
}>;

const errors: Record<string, string> = {
  validation: "Проверьте обязательные поля (название, slug, описание RU/KK, наставник, направление и количество мест).",
  forbidden: "Недостаточно прав для выполнения операции.",
  invalid_reference: "Наставник должен иметь верифицированный профиль с версиями RU и KK, научное направление должно быть активно.",
  invalid_transition: "Этот переход статуса недоступен.",
  not_found: "Предложение наставничества не найдено.",
  not_available: "Для принятия заявки опубликуйте предложение и проверьте доступность наставника.",
  capacity_exceeded: "Все места заняты или новый лимит меньше числа принятых заявок.",
  mentor_has_applications: "Сначала рассмотрите новые заявки и завершите активное наставничество. Затем можно удалить предложение или заменить наставника.",
  confirm_delete: "Подтвердите удаление, установив флажок.",
  action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug и повторите попытку.",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Almaty",
});

async function managerAccess() {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageMentorship(access.access)) notFound();
  return access.access;
}

function Notice({ state }: { state: Awaited<MentorshipAdminSearch> }) {
  return (
    <>
      {state.error ? (
        <div className="notice error-notice" role="alert">
          {errors[state.error] ?? errors.action_failed}
        </div>
      ) : null}
      {state.created === "1" ? (
        <div className="notice success-notice">Предложение наставничества успешно создано.</div>
      ) : null}
      {state.saved === "1" ? (
        <div className="notice success-notice">Изменения предложения сохранены.</div>
      ) : null}
      {state.application_saved === "1" ? (
        <div className="notice success-notice">Данные заявки успешно сохранены.</div>
      ) : null}
      {state.deleted === "1" ? (
        <div className="notice success-notice">Предложение перенесено в удалённые.</div>
      ) : null}
    </>
  );
}

export async function MentorshipAdminList({
  searchParams,
}: {
  searchParams: MentorshipAdminSearch;
}) {
  const access = await managerAccess();
  if (!access) return null;

  const state = await searchParams;
  const parsedStatus = mentorshipStatusSchema.safeParse(state.status);
  const statusFilter = parsedStatus.success ? parsedStatus.data : "all";
  const formatFilter = state.format ?? "all";
  const query = (state.q ?? "").trim().toLowerCase();

  const allOffers = await new MentorshipService().list(access, statusFilter);

  const filtered = allOffers.filter((offer) => {
    if (formatFilter !== "all" && offer.format !== formatFilter) return false;
    if (query) {
      const matchTitleRu = (offer.translations.find((t) => t.locale === "ru")?.title ?? "").toLowerCase();
      const matchTitleKk = (offer.translations.find((t) => t.locale === "kk")?.title ?? "").toLowerCase();
      const matchTitleEn = (offer.translations.find((t) => t.locale === "en")?.title ?? "").toLowerCase();
      const matchMentor = offer.mentor.some((m) => m.fullName.toLowerCase().includes(query));
      const matchField = (offer.field?.nameRu ?? "").toLowerCase().includes(query);
      if (
        !matchTitleRu.includes(query) &&
        !matchTitleKk.includes(query) &&
        !matchTitleEn.includes(query) &&
        !matchMentor &&
        !matchField
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Программы</span>
        <span>/</span>
        <strong>Наставничество</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Программы развития</p>
          <h1>Наставничество</h1>
          <p>Наставники, условия участия и заявки молодых исследователей.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={`${base}/applications`}>
            <Users size={16} aria-hidden="true" />
            <span>Все заявки</span>
          </Link>
          <Link className="primary-button" href={`${base}/new`}>
            <Plus size={16} aria-hidden="true" />
            <span>Добавить предложение</span>
          </Link>
        </div>
      </div>

      <Notice state={state} />

      <section className="media-toolbar" aria-label="Фильтры предложений">
        <form className="media-filters" action={base}>
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="visually-hidden">Поиск по названию, наставнику или направлению</span>
            <input
              type="search"
              name="q"
              defaultValue={state.q ?? ""}
              placeholder="Поиск по названию, наставнику или направлению"
              maxLength={120}
            />
          </label>
          <select name="status" aria-label="Статус" defaultValue={statusFilter}>
            <option value="all">Все статусы</option>
            {mentorshipStatuses.map((value) => (
              <option key={value} value={value}>
                {mentorshipStatusLabels[value]}
              </option>
            ))}
          </select>
          <select name="format" aria-label="Формат" defaultValue={formatFilter}>
            <option value="all">Все форматы</option>
            {mentorshipFormats.map((value) => (
              <option key={value} value={value}>
                {mentorshipFormatLabels.ru[value]}
              </option>
            ))}
          </select>
          <button type="submit" className="secondary-button">
            Применить
          </button>
        </form>
        <span className="real-count">
          {filtered.length} записей {statusFilter !== "all" || formatFilter !== "all" || query ? "найдено" : "всего"}
        </span>
      </section>

      <section className="data-panel">
        {filtered.length ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Предложение</th>
                  <th>Наставник</th>
                  <th>Формат</th>
                  <th>Мест</th>
                  <th>Статус</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((offer) => {
                  const ruTitle =
                    offer.translations.find((t) => t.locale === "ru")?.title ?? "Без названия";
                  const ruSlug = offer.translations.find((t) => t.locale === "ru")?.slug;
                  const mentorRu =
                    offer.mentor.find((t) => t.locale === "ru")?.fullName ?? "Профиль недоступен";

                  return (
                    <tr key={offer.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <Link href={`${base}/${offer.id}`} style={{ fontWeight: 600 }}>
                            {ruTitle}
                          </Link>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b" }}>
                            <span>{offer.field?.nameRu ?? "—"}</span>
                            {offer.status === "published" && ruSlug ? (
                              <Link
                                href={`/ru/mentorship/${ruSlug}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: "2px", color: "var(--forest-bright)" }}
                                title="Открыть на сайте"
                              >
                                <ExternalLink size={11} aria-hidden="true" />
                                <span>на сайте</span>
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <UserCheck size={14} style={{ color: "#0284c7" }} aria-hidden="true" />
                          <span>{mentorRu}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: "12px" }}>
                          {mentorshipFormatLabels.ru[offer.format]}
                        </span>
                      </td>
                      <td>
                        <strong>{offer.capacity}</strong>
                      </td>
                      <td>
                        <span className={`status-badge status-${offer.status}`}>
                          {mentorshipStatusLabels[offer.status]}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "#64748b" }}>
                        {dateFormatter.format(new Date(offer.updatedAt))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Предложения не найдены</h3>
            <p>
              {query || statusFilter !== "all" || formatFilter !== "all"
                ? "Попробуйте изменить параметры поиска или сбросить фильтры."
                : "Добавьте первого наставника и условия программы."}
            </p>
            {query || statusFilter !== "all" || formatFilter !== "all" ? (
              <Link href={base} className="secondary-button" style={{ marginTop: "12px" }}>
                Сбросить фильтры
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function ApplicationCard({
  application,
  progress,
  queue = false,
}: {
  application: MentorshipApplication;
  progress?: any | null;
  queue?: boolean;
}) {
  const copy = mentorshipProgressCopy.ru;

  return (
    <article className="article-editor-panel mentorship-application" style={{ marginBottom: "20px" }}>
      <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 650 }}>{application.fullName}</h3>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            {dateTimeFormatter.format(new Date(application.createdAt))} · Язык заявки: {application.locale.toUpperCase()}
          </p>
        </div>
        <span className={`status-badge status-${application.status}`}>
          {applicationStatusLabels[application.status]}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", fontSize: "13px" }}>
        <Mail size={14} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
        <a href={`mailto:${application.email}`} style={{ color: "var(--forest-bright)", textDecoration: "underline" }}>
          {application.email}
        </a>
      </div>

      <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "12px" }}>
        <p style={{ margin: "0 0 4px", fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "#64748b" }}>
          Мотивация и цели заявителя:
        </p>
        <p className="mentorship-motivation" style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "#334155" }}>
          {application.motivation}
        </p>
      </div>

      <p className="field-hint" style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "14px" }}>
        Согласие на обработку заявки получено {dateFormatter.format(new Date(application.consentAt))}.
      </p>

      {/* STATUS UPDATE FORM */}
      <form
        className="translation-fields"
        action={updateMentorshipApplication.bind(null, application.id, application.offerId)}
        style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "10px" }}
      >
        <input type="hidden" name="returnTo" value={queue ? "queue" : "offer"} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Статус рассмотрения</span>
            <select
              name="status"
              defaultValue={application.status}
              style={{ padding: "6px 10px", fontSize: "13px" }}
            >
              {applicationStatuses
                .filter((value) => canChangeApplicationStatus(application.status, value))
                .map((value) => (
                  <option key={value} value={value}>
                    {applicationStatusLabels[value]}
                  </option>
                ))}
            </select>
          </label>

          {!progress?.relation && ["new", "in_review"].includes(application.status) ? (
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Роль при принятии</span>
              <select name="kind" defaultValue="mentor" style={{ padding: "6px 10px", fontSize: "13px" }}>
                {mentorshipKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {copy.kinds[kind]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Внутренняя заметка координатора</span>
          <textarea
            name="note"
            defaultValue={application.managerNote}
            rows={2}
            maxLength={5000}
            placeholder="Заметка видна только менеджерам программы..."
            style={{ width: "100%", padding: "8px 10px", fontSize: "13px" }}
          />
        </label>

        <div>
          <SubmitButton label="Сохранить решение по заявке" />
        </div>
      </form>

      {progress ? (
        <div style={{ marginTop: "14px" }}>
          <MentorshipProgress locale="ru" progress={progress} />
        </div>
      ) : null}

      {progress?.relation && ["active", "paused"].includes(progress.relation.status) ? (
        <form
          className="translation-fields"
          action={changeMentorshipRelation.bind(null, application.id)}
          style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "12px", marginTop: "12px" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "8px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Статус наставничества</span>
              <select
                name="relationStatus"
                defaultValue={progress.relation.status}
                style={{ padding: "6px 10px", fontSize: "13px" }}
              >
                {mentorshipRelationStatuses
                  .filter(
                    (status) =>
                      status === progress.relation?.status ||
                      canChangeMentorshipRelationStatus(progress.relation!.status, status)
                  )
                  .map((status) => (
                    <option key={status} value={status}>
                      {copy.statuses[status]}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="field-hint" style={{ fontSize: "12px", color: "#64748b", margin: "0 0 10px" }}>
            Приостановленное наставничество занимает место. Прекращение отзывает заявку; завершение и прекращение окончательны.
          </p>
          <div>
            <SubmitButton label="Обновить статус наставничества" />
          </div>
        </form>
      ) : null}
    </article>
  );
}

export async function MentorshipAdminEditor({
  id,
  searchParams,
}: {
  id?: string;
  searchParams: MentorshipAdminSearch;
}) {
  const access = await managerAccess();
  if (!access) return null;
  if (id && !z.uuid().safeParse(id).success) notFound();

  const service = new MentorshipService();
  const offer = id ? await service.getById(access, id) : undefined;
  if (id && !offer) notFound();

  const [state, options, applications] = await Promise.all([
    searchParams,
    service.options(access),
    id ? service.applications(access, id) : Promise.resolve([]),
  ]);

  const progressList =
    id && applications.length
      ? await Promise.all(applications.map((a) => service.progress(access, a.id)))
      : [];

  const ruTitle = offer?.translations.find((t) => t.locale === "ru")?.title;

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Программы</span>
        <span>/</span>
        <Link href={base}>Наставничество</Link>
        <span>/</span>
        <strong>{ruTitle ?? "Новое предложение"}</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Программы развития</p>
          <h1>{ruTitle ?? "Новое предложение"}</h1>
          <p>
            {offer
              ? "Редактирование условий, наставника и языковых версий предложения."
              : "Заполните сведения о наставнике, направлениях и языковых версиях программы."}
          </p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={base}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>К списку предложений</span>
          </Link>
          {offer ? (
            <a className="secondary-button" href="#applications">
              <Users size={16} aria-hidden="true" />
              <span>Заявки ({applications.length})</span>
            </a>
          ) : null}
        </div>
      </div>

      <Notice state={state} />

      {/* WORKFLOW STATUS ACTIONS */}
      {offer ? (
        <section className="workflow-panel" style={{ marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span className={`status-badge status-${offer.status}`} style={{ fontSize: "13px" }}>
                {mentorshipStatusLabels[offer.status]}
              </span>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                Последнее обновление: {dateFormatter.format(new Date(offer.updatedAt))}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
              {offer.status === "published"
                ? "Предложение опубликовано на сайте и принимает заявки участников."
                : offer.status === "draft"
                ? "Черновик не виден в публичном каталоге. Для приёма заявок опубликуйте предложение."
                : "В архиве новые заявки не принимаются. Существующие заявки и связи сохраняются."}
            </p>
            {offer.status === "published" ? (
              <div className="heading-actions" style={{ marginTop: "10px", display: "flex", gap: "12px" }}>
                {offer.translations.map((t) => (
                  <Link
                    key={t.locale}
                    href={`/${t.locale}/mentorship/${t.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "13px",
                      color: "var(--forest-bright)",
                      fontWeight: 500,
                    }}
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    <span>Открыть {t.locale.toUpperCase()}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="workflow-actions" style={{ display: "flex", gap: "8px" }}>
            {mentorshipStatuses
              .filter((value) => canChangeMentorshipStatus(offer.status, value))
              .map((value) => (
                <form key={value} action={changeMentorshipOffer.bind(null, offer.id, value)}>
                  <button
                    className={value === "published" ? "primary-button" : "secondary-button"}
                    type="submit"
                  >
                    {value === "published"
                      ? "Опубликовать"
                      : value === "draft"
                      ? "В черновики"
                      : "В архив"}
                  </button>
                </form>
              ))}
          </div>
        </section>
      ) : null}

      {/* WP-STYLE FORM */}
      <MentorshipForm
        action={saveMentorshipOffer.bind(null, offer?.id ?? null)}
        offer={offer ?? undefined}
        options={options}
      />

      {/* APPLICATIONS SECTION */}
      {offer ? (
        <>
          <section className="mentorship-applications" id="applications" style={{ marginTop: "40px" }}>
            <div className="media-detail-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700 }}>
                  Заявки на участие ({applications.length})
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Связывайтесь с заявителями по email; внутренние заметки видны только менеджерам.
                </p>
              </div>
              <Link className="secondary-button" href={`${base}/applications`}>
                Все заявки и фильтры
              </Link>
            </div>

            {applications.length ? (
              applications.map((item, idx) => (
                <ApplicationCard
                  key={item.id}
                  application={item}
                  progress={progressList[idx]}
                />
              ))
            ) : (
              <div className="empty-state">
                <p>Заявок на это предложение пока нет.</p>
              </div>
            )}
          </section>

          {/* DANGER ZONE */}
          <section className="danger-zone" style={{ marginTop: "40px" }}>
            <div>
              <h2>Удалить предложение</h2>
              <p>
                Доступно после рассмотрения заявок и завершения активного наставничества.
              </p>
            </div>
            <form action={changeMentorshipOffer.bind(null, offer.id, "delete")}>
              <label className="confirm-check">
                <input type="checkbox" name="confirm" value="yes" required />
                <span>Подтверждаю удаление предложения</span>
              </label>
              <button className="danger-button" type="submit">
                <Trash2 size={16} aria-hidden="true" />
                <span>Удалить предложение</span>
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}

export async function MentorshipApplicationQueue({
  searchParams,
}: {
  searchParams: MentorshipAdminSearch;
}) {
  const access = await managerAccess();
  if (!access) return null;

  const state = await searchParams;
  const parsed = applicationStatusSchema.safeParse(state.status);
  const status = parsed.success ? parsed.data : "all";

  if (state.application && !z.uuid().safeParse(state.application).success) notFound();

  const service = new MentorshipService();
  const applications = await service.applications(
    access,
    undefined,
    status,
    state.application
  );

  const progressList = applications.length
    ? await Promise.all(applications.map((a) => service.progress(access, a.id)))
    : [];

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Программы</span>
        <span>/</span>
        <Link href={base}>Наставничество</Link>
        <span>/</span>
        <strong>Заявки на участие</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Наставничество</p>
          <h1>Заявки на участие</h1>
          <p>Очередь заявок молодых исследователей и решения координаторов.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={base}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>К предложениям</span>
          </Link>
        </div>
      </div>

      <Notice state={state} />

      <section className="media-toolbar" aria-label="Фильтры заявок">
        <form className="media-filters">
          <select name="status" defaultValue={status} aria-label="Статус заявки">
            <option value="all">Все статусы заявок</option>
            {applicationStatuses.map((value) => (
              <option key={value} value={value}>
                {applicationStatusLabels[value]}
              </option>
            ))}
          </select>
          <button type="submit" className="secondary-button">
            Применить
          </button>
        </form>
        <span className="real-count">{applications.length} заявок</span>
      </section>

      {applications.length ? (
        <div className="mentorship-applications">
          {applications.map((application, idx) => (
            <div key={application.id} style={{ marginBottom: "20px" }}>
              <div style={{ marginBottom: "6px" }}>
                <Link
                  className="button-link"
                  href={`${base}/${application.offerId}#applications`}
                  style={{
                    fontSize: "13px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "var(--forest-bright)",
                  }}
                >
                  <span>Открыть предложение →</span>
                </Link>
              </div>
              <ApplicationCard
                application={application}
                progress={progressList[idx]}
                queue
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Заявки не найдены</h2>
          <p>Измените выбранный фильтр или дождитесь новых заявок от кандидатов.</p>
        </div>
      )}
    </div>
  );
}
