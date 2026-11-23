import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FolderGit2,
  Layers,
  Mail,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { SubmitButton } from "@/components/science/SubmitButton";
import { ResearchProgramForm } from "./ResearchProgramForm";
import { ResearchProgramProjectsEditor } from "./ResearchProgramProjectsEditor";
import { ResearchProgramProjectsService } from "@/server/services/research-program-projects.service";
import { canManageResearchProgram } from "@/lib/permissions/permissions";
import {
  applicationStatusLabels,
  canChangeApplicationStatus,
  canChangeResearchProgramStatus,
  programApplicationsOpen,
  programDate,
  researchProgramAdminPath as base,
  researchProgramFormatLabels,
  researchProgramStatusLabels,
} from "@/lib/research-program";
import {
  applicationStatusSchema,
  researchProgramStatusSchema,
} from "@/lib/validation/research-program";
import {
  assignResearchProgramMentor,
  changeResearchProgram,
  saveResearchProgram,
  updateResearchProgramApplication,
} from "@/server/actions/research-program.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ResearchProgramService } from "@/server/services/research-program.service";
import {
  applicationStatuses,
  researchProgramFormats,
  researchProgramStatuses,
  type ResearchProgramApplication,
} from "@/types/domain/research-program";
import type { AccessContext } from "@/types/domain/auth";
import type { ScienceWorkOptions } from "@/types/domain/science-work";

export type ResearchProgramAdminSearch = Promise<{
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
  stale_version: "Связи изменены другим пользователем. Обновите страницу и повторите изменения.",
  validation:
    "Проверьте обязательные поля RU/KK, количество мест и последовательность дат набора и проведения.",
  forbidden: "Недостаточно прав для выполнения операции.",
  invalid_reference:
    "Координатор должен иметь верифицированный профиль с версиями RU и KK, научное направление должно быть активно.",
  invalid_transition: "Этот переход статуса недоступен.",
  not_found: "Исследовательская программа не найдена.",
  not_available:
    "Для принятия заявки опубликуйте программу и проверьте доступность координатора и срок завершения программы.",
  capacity_exceeded: "Все места заняты или лимит меньше числа принятых и завершивших участие заявок.",
  program_has_applications:
    "Сначала рассмотрите новые заявки и завершите активное участие в программе. Затем можно удалить программу или заменить координатора.",
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
  if (!canManageResearchProgram(access.access)) notFound();
  return access.access;
}

function Notice({ state }: { state: Awaited<ResearchProgramAdminSearch> }) {
  return (
    <>
      {state.error ? (
        <div className="notice error-notice" role="alert">
          {errors[state.error] ?? errors.action_failed}
        </div>
      ) : null}
      {state.created === "1" ? (
        <div className="notice success-notice">Исследовательская программа успешно создана.</div>
      ) : null}
      {state.saved === "1" ? (
        <div className="notice success-notice">Изменения программы сохранены.</div>
      ) : null}
      {state.application_saved === "1" ? (
        <div className="notice success-notice">Данные заявки успешно сохранены.</div>
      ) : null}
      {state.deleted === "1" ? (
        <div className="notice success-notice">Программа перенесена в удалённые.</div>
      ) : null}
    </>
  );
}

export async function ResearchProgramAdminList({
  searchParams,
}: {
  searchParams: ResearchProgramAdminSearch;
}) {
  const access = await managerAccess();
  if (!access) return null;

  const state = await searchParams;
  const parsedStatus = researchProgramStatusSchema.safeParse(state.status);
  const statusFilter = parsedStatus.success ? parsedStatus.data : "all";
  const formatFilter = state.format ?? "all";
  const query = (state.q ?? "").trim().toLowerCase();

  const allPrograms = await new ResearchProgramService().list(access, statusFilter);

  const filtered = allPrograms.filter((program) => {
    if (formatFilter !== "all" && program.format !== formatFilter) return false;
    if (query) {
      const matchTitleRu = (program.translations.find((t) => t.locale === "ru")?.title ?? "").toLowerCase();
      const matchTitleKk = (program.translations.find((t) => t.locale === "kk")?.title ?? "").toLowerCase();
      const matchTitleEn = (program.translations.find((t) => t.locale === "en")?.title ?? "").toLowerCase();
      const matchCoordinator = program.coordinator.some((c) => c.fullName.toLowerCase().includes(query));
      const matchField = (program.field?.nameRu ?? "").toLowerCase().includes(query);
      if (
        !matchTitleRu.includes(query) &&
        !matchTitleKk.includes(query) &&
        !matchTitleEn.includes(query) &&
        !matchCoordinator &&
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
        <strong>Research Program</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Программы развития</p>
          <h1>Research Program</h1>
          <p>Программы, условия участия и заявки молодых исследователей.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={`${base}/applications`}>
            <Users size={16} aria-hidden="true" />
            <span>Все заявки</span>
          </Link>
          <Link className="primary-button" href={`${base}/new`}>
            <Plus size={16} aria-hidden="true" />
            <span>Добавить программу</span>
          </Link>
        </div>
      </div>

      <Notice state={state} />

      <section className="media-toolbar" aria-label="Фильтры программ">
        <form className="media-filters" action={base}>
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="visually-hidden">Поиск по названию, координатору или направлению</span>
            <input
              type="search"
              name="q"
              defaultValue={state.q ?? ""}
              placeholder="Поиск по названию, координатору или направлению"
              maxLength={120}
            />
          </label>
          <select name="status" aria-label="Статус" defaultValue={statusFilter}>
            <option value="all">Все статусы</option>
            {researchProgramStatuses.map((value) => (
              <option key={value} value={value}>
                {researchProgramStatusLabels[value]}
              </option>
            ))}
          </select>
          <select name="format" aria-label="Формат" defaultValue={formatFilter}>
            <option value="all">Все форматы</option>
            {researchProgramFormats.map((value) => (
              <option key={value} value={value}>
                {researchProgramFormatLabels.ru[value]}
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
                  <th>Программа</th>
                  <th>Координатор</th>
                  <th>Формат</th>
                  <th>Сроки проведения</th>
                  <th>Мест</th>
                  <th>Статус</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((program) => {
                  const ruTitle =
                    program.translations.find((t) => t.locale === "ru")?.title ?? "Без названия";
                  const ruSlug = program.translations.find((t) => t.locale === "ru")?.slug;
                  const coordinatorRu =
                    program.coordinator.find((t) => t.locale === "ru")?.fullName ?? "Профиль недоступен";
                  const isOpen = programApplicationsOpen(program);

                  return (
                    <tr key={program.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <Link href={`${base}/${program.id}`} style={{ fontWeight: 600 }}>
                            {ruTitle}
                          </Link>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b" }}>
                            <span>{program.field?.nameRu ?? "—"}</span>
                            {program.status === "published" && ruSlug ? (
                              <Link
                                href={`/ru/research-program/${ruSlug}`}
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
                          <span>{coordinatorRu}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: "12px" }}>
                          {researchProgramFormatLabels.ru[program.format]}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span>
                            {programDate(program.startsOn, "ru")} — {programDate(program.endsOn, "ru")}
                          </span>
                          <span style={{ fontSize: "11px", color: isOpen ? "#16a34a" : "#64748b" }}>
                            {isOpen ? "Набор открыт" : "Набор закрыт"} (до {programDate(program.applicationDeadline, "ru")})
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{program.capacity}</strong>
                      </td>
                      <td>
                        <span className={`status-badge status-${program.status}`}>
                          {researchProgramStatusLabels[program.status]}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "#64748b" }}>
                        {dateFormatter.format(new Date(program.updatedAt))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Программы не найдены</h3>
            <p>
              {query || statusFilter !== "all" || formatFilter !== "all"
                ? "Попробуйте изменить параметры поиска или сбросить фильтры."
                : "Добавьте первую исследовательскую программу."}
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

export async function ResearchProgramApplicationCard({
  application,
  participation: passedParticipation,
  access,
  scientists,
  queue = false,
}: {
  application: ResearchProgramApplication;
  participation?: { status: "active" | "completed"; version: number; mentorId: string | null } | null;
  access?: AccessContext;
  scientists: ScienceWorkOptions["scientists"];
  queue?: boolean;
}) {
  const participation =
    passedParticipation !== undefined
      ? passedParticipation
      : access && ["accepted", "completed"].includes(application.status)
      ? await new ResearchProgramService().participation(access, application.id)
      : null;

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
        action={updateResearchProgramApplication.bind(null, application.id, application.programId)}
        style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "10px" }}
      >
        <input type="hidden" name="returnTo" value={queue ? "queue" : "program"} />
        <div style={{ marginBottom: "12px" }}>
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
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Внутренняя заметка координатора</span>
          <textarea
            name="note"
            defaultValue={application.managerNote}
            rows={2}
            maxLength={5000}
            placeholder="Заметка видна только координаторам программы..."
            style={{ width: "100%", padding: "8px 10px", fontSize: "13px" }}
          />
        </label>

        <div>
          <SubmitButton label="Сохранить решение по заявке" />
        </div>
      </form>

      {/* PARTICIPATION & MENTOR ASSIGNMENT */}
      {participation ? (
        <section
          className="account-claim"
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#f0fdf4",
            borderRadius: "8px",
            border: "1px solid #bbf7d0",
          }}
        >
          <h4 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 650, color: "#166534" }}>
            Участие в программе: {participation.status === "active" ? "Активное" : "Завершено"}
          </h4>

          {participation.status === "active" ? (
            <form
              className="translation-fields"
              action={assignResearchProgramMentor.bind(null, application.id, application.programId)}
              style={{ marginTop: "10px" }}
            >
              <input type="hidden" name="returnTo" value={queue ? "queue" : "program"} />
              <input type="hidden" name="version" value={participation.version} />
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Назначенный наставник</span>
                <select
                  name="mentorId"
                  defaultValue={participation.mentorId ?? ""}
                  style={{ padding: "6px 10px", fontSize: "13px" }}
                >
                  <option value="">Не назначен</option>
                  {scientists.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  {participation.mentorId && !scientists.some((item) => item.id === participation.mentorId) ? (
                    <option value={participation.mentorId} disabled>
                      Профиль недоступен — выберите другого наставника
                    </option>
                  ) : null}
                </select>
              </label>
              <div>
                <SubmitButton label="Сохранить наставника" />
              </div>
            </form>
          ) : (
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151" }}>
              Назначенный наставник:{" "}
              <strong>
                {scientists.find((item) => item.id === participation.mentorId)?.name ??
                  (participation.mentorId ? "Профиль недоступен" : "Не назначен")}
              </strong>
            </p>
          )}
        </section>
      ) : null}
    </article>
  );
}

export async function ResearchProgramAdminEditor({
  id,
  searchParams,
}: {
  id?: string;
  searchParams: ResearchProgramAdminSearch;
}) {
  const access = await managerAccess();
  if (!access) return null;
  if (id && !z.uuid().safeParse(id).success) notFound();

  const service = new ResearchProgramService();
  const program = id ? await service.getById(access, id) : undefined;
  if (id && !program) notFound();

  const projects = id ? await new ResearchProgramProjectsService().get(access, id) : null;
  const [state, options, applications] = await Promise.all([
    searchParams,
    service.options(access),
    id ? service.applications(access, id) : Promise.resolve([]),
  ]);

  const participations =
    id && applications.length
      ? await Promise.all(
          applications.map((a) =>
            ["accepted", "completed"].includes(a.status)
              ? service.participation(access, a.id)
              : Promise.resolve(null)
          )
        )
      : [];

  const ruTitle = program?.translations.find((t) => t.locale === "ru")?.title;

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Программы</span>
        <span>/</span>
        <Link href={base}>Research Program</Link>
        <span>/</span>
        <strong>{ruTitle ?? "Новая программа"}</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Программы развития</p>
          <h1>{ruTitle ?? "Новая программа"}</h1>
          <p>
            {program
              ? "Редактирование условий, координатора, дат и языковых версий исследовательской программы."
              : "Заполните сведения о координаторе, направлениях, сроках и содержании программы."}
          </p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={base}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>К списку программ</span>
          </Link>
          {program && projects ? (
            <a className="secondary-button" href="#projects">
              <FolderGit2 size={16} aria-hidden="true" />
              <span>Проекты ({projects.graph.workIds.length})</span>
            </a>
          ) : null}
          {program ? (
            <a className="secondary-button" href="#applications">
              <Users size={16} aria-hidden="true" />
              <span>Заявки ({applications.length})</span>
            </a>
          ) : null}
        </div>
      </div>

      <Notice state={state} />

      {/* WORKFLOW STATUS ACTIONS */}
      {program ? (
        <section className="workflow-panel" style={{ marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span className={`status-badge status-${program.status}`} style={{ fontSize: "13px" }}>
                {researchProgramStatusLabels[program.status]}
              </span>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                Последнее обновление: {dateFormatter.format(new Date(program.updatedAt))}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
              {program.status === "published"
                ? "Программа опубликована на сайте. Приём заявок открыт в установленный период дат."
                : program.status === "draft"
                ? "Черновик не виден в публичном каталоге. Для приёма заявок опубликуйте программу."
                : "В архиве новые заявки не принимаются. Существующие заявки и проекты сохраняются."}
            </p>
            {program.status === "published" ? (
              <div className="heading-actions" style={{ marginTop: "10px", display: "flex", gap: "12px" }}>
                {program.translations.map((t) => (
                  <Link
                    key={t.locale}
                    href={`/${t.locale}/research-program/${t.slug}`}
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
            {researchProgramStatuses
              .filter((value) => canChangeResearchProgramStatus(program.status, value))
              .map((value) => (
                <form key={value} action={changeResearchProgram.bind(null, program.id, value)}>
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
      <ResearchProgramForm
        action={saveResearchProgram.bind(null, program?.id ?? null)}
        program={program ?? undefined}
        options={options}
      />

      {/* PROJECTS EDITOR */}
      {program && projects ? (
        <ResearchProgramProjectsEditor
          key={projects.graph.version}
          programId={program.id}
          {...projects}
        />
      ) : null}

      {/* APPLICATIONS SECTION */}
      {program ? (
        <>
          <section className="mentorship-applications" id="applications" style={{ marginTop: "40px" }}>
            <div
              className="media-detail-heading"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}
            >
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
              await Promise.all(
                applications.map(async (item, idx) => (
                  <div key={item.id}>
                    {await ResearchProgramApplicationCard({
                      application: item,
                      participation: participations[idx],
                      access,
                      scientists: options.scientists,
                    })}
                  </div>
                ))
              )
            ) : (
              <div className="empty-state">
                <p>Заявок на эту программу пока нет.</p>
              </div>
            )}
          </section>

          {/* DANGER ZONE */}
          <section className="danger-zone" style={{ marginTop: "40px" }}>
            <div>
              <h2>Удалить программу</h2>
              <p>
                Доступно после рассмотрения заявок и завершения участия принятых заявителей.
              </p>
            </div>
            <form action={changeResearchProgram.bind(null, program.id, "delete")}>
              <label className="confirm-check">
                <input type="checkbox" name="confirm" value="yes" required />
                <span>Подтверждаю удаление программы</span>
              </label>
              <button className="danger-button" type="submit">
                <Trash2 size={16} aria-hidden="true" />
                <span>Удалить программу</span>
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}

export async function ResearchProgramApplicationQueue({
  searchParams,
}: {
  searchParams: ResearchProgramAdminSearch;
}) {
  const access = await managerAccess();
  if (!access) return null;

  const state = await searchParams;
  const parsed = applicationStatusSchema.safeParse(state.status);
  const status = parsed.success ? parsed.data : "all";

  if (state.application && !z.uuid().safeParse(state.application).success) notFound();

  const service = new ResearchProgramService();
  const applications = await service.applications(
    access,
    undefined,
    status,
    state.application
  );

  const hasParticipations = applications.some((item) =>
    ["accepted", "completed"].includes(item.status)
  );

  const options = hasParticipations ? await service.options(access) : { scientists: [] };

  const participations = applications.length
    ? await Promise.all(
        applications.map((a) =>
          ["accepted", "completed"].includes(a.status)
            ? service.participation(access, a.id)
            : Promise.resolve(null)
        )
      )
    : [];

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Программы</span>
        <span>/</span>
        <Link href={base}>Research Program</Link>
        <span>/</span>
        <strong>Заявки на участие</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Research Program</p>
          <h1>Заявки на участие</h1>
          <p>Очередь заявок молодых исследователей по выбранному статусу.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={base}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>К программам</span>
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
          {await Promise.all(
            applications.map(async (application, idx) => (
              <div key={application.id} style={{ marginBottom: "20px" }}>
                <div style={{ marginBottom: "6px" }}>
                  <Link
                    className="button-link"
                    href={`${base}/${application.programId}#applications`}
                    style={{
                      fontSize: "13px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--forest-bright)",
                    }}
                  >
                    <span>Открыть программу →</span>
                  </Link>
                </div>
                {await ResearchProgramApplicationCard({
                  application,
                  participation: participations[idx],
                  access,
                  scientists: options.scientists,
                  queue: true,
                })}
              </div>
            ))
          )}
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
