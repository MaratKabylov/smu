import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SubmitButton } from "@/components/science/SubmitButton";
import { ResearchProgramForm } from "./ResearchProgramForm";
import { canManageResearchProgram } from "@/lib/permissions/permissions";
import { applicationStatusLabels, canChangeApplicationStatus, canChangeResearchProgramStatus, researchProgramAdminPath as base, researchProgramFormatLabels, researchProgramStatusLabels } from "@/lib/research-program";
import { applicationStatusSchema, researchProgramStatusSchema } from "@/lib/validation/research-program";
import { changeResearchProgram, saveResearchProgram, updateResearchProgramApplication } from "@/server/actions/research-program.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ResearchProgramService } from "@/server/services/research-program.service";
import { applicationStatuses, researchProgramStatuses, type ResearchProgramApplication } from "@/types/domain/research-program";

export type ResearchProgramAdminSearch = Promise<{ status?: string; error?: string; saved?: string; deleted?: string; application_saved?: string }>;
const errors: Record<string, string> = {
  validation: "Проверьте поля RU/KK, количество мест и последовательность дат набора и проведения.", forbidden: "Недостаточно прав.",
  invalid_reference: "Координатор должен иметь верифицированный профиль с обеими языковыми версиями, направление должно быть активно.",
  invalid_transition: "Этот переход статуса недоступен.", not_found: "Запись недоступна.", not_available: "Для принятия заявки опубликуйте программу и проверьте доступность координатора и срок завершения программы.",
  capacity_exceeded: "Все места заняты или лимит меньше числа принятых и завершивших участие заявок.",
  program_has_applications: "Сначала рассмотрите новые заявки и завершите активное участие в программе. Затем можно удалить программу или заменить координатора.",
  confirm_delete: "Подтвердите удаление.", action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug и повторите попытку.",
};
async function managerAccess() {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageResearchProgram(access.access)) notFound();
  return access.access;
}
function Notice({ state }: { state: Awaited<ResearchProgramAdminSearch> }) {
  return <>{state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? errors.action_failed}</div> : null}
    {state.saved === "1" || state.application_saved === "1" ? <div className="notice success-notice">Изменения сохранены.</div> : null}
    {state.deleted === "1" ? <div className="notice success-notice">Программа перенесена в удалённые.</div> : null}</>;
}
export async function ResearchProgramAdminList({ searchParams }: { searchParams: ResearchProgramAdminSearch }) {
  const access = await managerAccess(); if (!access) return null;
  const state = await searchParams;
  const parsed = researchProgramStatusSchema.safeParse(state.status);
  const status = parsed.success ? parsed.data : "all";
  const programs = await new ResearchProgramService().list(access, status);
  return <div className="content-page"><div className="page-heading media-page-heading"><div><p className="page-kicker">Программы</p><h1>Research Program</h1><p>Программы, условия участия и заявки молодых исследователей.</p></div><div className="heading-actions"><Link className="secondary-button" href={base + "/applications"}>Все заявки</Link><Link className="primary-button" href={base + "/new"}>Добавить программу</Link></div></div>
    <Notice state={state} /><section className="media-toolbar"><form className="media-filters" action={base}><select name="status" aria-label="Статус" defaultValue={status}><option value="all">Все статусы</option>{researchProgramStatuses.map(value => <option key={value} value={value}>{researchProgramStatusLabels[value]}</option>)}</select><button className="secondary-button">Применить</button></form><span className="real-count">{programs.length} записей · до 100 последних</span></section>
    <section className="data-panel">{programs.length ? <div className="table-wrap"><table className="articles-table"><thead><tr><th>Программа</th><th>Координатор</th><th>Формат</th><th>Мест</th><th>Статус</th></tr></thead><tbody>{programs.map(program => <tr key={program.id}><td><Link href={base + "/" + program.id}>{program.translations.find(t => t.locale === "ru")?.title ?? "Без названия"}</Link><small>{program.field?.nameRu ?? "—"}</small></td><td>{program.coordinator.find(t => t.locale === "ru")?.fullName ?? "Профиль недоступен"}</td><td>{researchProgramFormatLabels.ru[program.format]}</td><td>{program.capacity}</td><td><span className={"status-badge status-" + program.status}>{researchProgramStatusLabels[program.status]}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>Программы не найдены</h3><p>Создайте программу или измените фильтр.</p></div>}</section>
  </div>;
}
function ApplicationCard({ application, queue = false }: { application: ResearchProgramApplication; queue?: boolean }) {
  return <article className="article-editor-panel mentorship-application"><div className="panel-title"><div><h3>{application.fullName}</h3><p>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" }).format(new Date(application.createdAt))} · {application.locale.toUpperCase()}</p></div><span className="status-badge">{applicationStatusLabels[application.status]}</span></div>
    <a href={"mailto:" + application.email}>{application.email}</a><p className="mentorship-motivation">{application.motivation}</p><p className="field-hint">Согласие на обработку заявки получено {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Asia/Almaty" }).format(new Date(application.consentAt))}.</p>
    <form className="translation-fields" action={updateResearchProgramApplication.bind(null, application.id, application.programId)}>
      <input type="hidden" name="returnTo" value={queue ? "queue" : "program"} />
      <label>Статус<select name="status" defaultValue={application.status}>{applicationStatuses.filter(value => canChangeApplicationStatus(application.status, value)).map(value => <option key={value} value={value}>{applicationStatusLabels[value]}</option>)}</select></label>
      <label>Внутренняя заметка<textarea name="note" defaultValue={application.managerNote} rows={3} maxLength={5000} /></label><div><SubmitButton label="Сохранить заявку" /></div>
    </form>
  </article>;
}
export async function ResearchProgramAdminEditor({ id, searchParams }: { id?: string; searchParams: ResearchProgramAdminSearch }) {
  const access = await managerAccess(); if (!access) return null;
  if (id && !z.uuid().safeParse(id).success) notFound();
  const service = new ResearchProgramService();
  const program = id ? await service.getById(access, id) : undefined;
  if (id && !program) notFound();
  const [state, options, applications] = await Promise.all([searchParams, service.options(access), id ? service.applications(access, id) : Promise.resolve([])]);
  return <div className="content-page"><Link className="back-link" href={base}>← Research Program</Link><div className="media-detail-heading"><div><p className="page-kicker">Программы</p><h1>{program?.translations.find(t => t.locale === "ru")?.title ?? "Новая программа"}</h1><p>Сохраните обе языковые версии и опубликуйте программу для приёма заявок.</p></div></div><Notice state={state} />
    {program ? <section className="workflow-panel"><div><h2>{researchProgramStatusLabels[program.status]}</h2><p>Набор открыт только в указанные даты. В архиве новые заявки не принимаются. Принятые и завершившие участие учитываются в лимите набора.</p>{program.status === "published" ? <div className="heading-actions">{program.translations.map(t => <Link key={t.locale} href={"/" + t.locale + "/research-program/" + t.slug} target="_blank">Открыть {t.locale.toUpperCase()}</Link>)}</div> : null}</div><div className="workflow-actions">{researchProgramStatuses.filter(value => canChangeResearchProgramStatus(program.status, value)).map(value => <form key={value} action={changeResearchProgram.bind(null, program.id, value)}><button className={value === "published" ? "primary-button" : "secondary-button"}>{value === "published" ? "Опубликовать" : value === "draft" ? "В черновики" : "В архив"}</button></form>)}</div></section> : null}
    <ResearchProgramForm action={saveResearchProgram.bind(null, program?.id ?? null)} program={program ?? undefined} options={options} />
    {program ? <><section className="mentorship-applications" id="applications"><div className="media-detail-heading"><div><h2>Заявки на участие</h2><p>До 100 последних заявок. Связывайтесь с заявителем по email; заметки видны только менеджерам.</p></div><Link href={base + "/applications"}>Все заявки и фильтры</Link></div>{applications.length ? applications.map(item => <ApplicationCard key={item.id} application={item} />) : <div className="empty-state"><p>Заявок пока нет.</p></div>}</section>
      <section className="danger-zone"><div><h2>Удалить программу</h2><p>Доступно после рассмотрения заявок и завершения участия принятых заявителей.</p></div><form action={changeResearchProgram.bind(null, program.id, "delete")}><label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю действие</label><button className="danger-button">Удалить</button></form></section></> : null}
  </div>;
}
export async function ResearchProgramApplicationQueue({ searchParams }: { searchParams: ResearchProgramAdminSearch }) {
  const access = await managerAccess(); if (!access) return null;
  const state = await searchParams;
  const parsed = applicationStatusSchema.safeParse(state.status);
  const status = parsed.success ? parsed.data : "all";
  const applications = await new ResearchProgramService().applications(access, undefined, status);
  return <div className="content-page"><Link className="back-link" href={base}>← Research Program</Link><div className="page-heading"><div><p className="page-kicker">Research Program</p><h1>Заявки на участие</h1><p>До 100 последних заявок по выбранному статусу.</p></div></div><Notice state={state} />
    <section className="media-toolbar"><form className="media-filters"><select name="status" defaultValue={status} aria-label="Статус заявки"><option value="all">Все статусы</option>{applicationStatuses.map(value => <option key={value} value={value}>{applicationStatusLabels[value]}</option>)}</select><button className="secondary-button">Применить</button></form></section>
    {applications.length ? <div className="mentorship-applications">{applications.map(application => <div key={application.id}><Link className="back-link" href={base + "/" + application.programId + "#applications"}>Открыть программу →</Link><ApplicationCard application={application} queue /></div>)}</div> : <div className="empty-state"><h2>Заявки не найдены</h2><p>Измените фильтр или дождитесь новых заявок.</p></div>}
  </div>;
}
