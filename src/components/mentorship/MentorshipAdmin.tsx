import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SubmitButton } from "@/components/science/SubmitButton";
import { MentorshipForm } from "./MentorshipForm";
import { canManageMentorship } from "@/lib/permissions/permissions";
import { applicationStatusLabels, canChangeApplicationStatus, canChangeMentorshipStatus, mentorshipAdminPath as base, mentorshipFormatLabels, mentorshipStatusLabels } from "@/lib/mentorship";
import { applicationStatusSchema, mentorshipStatusSchema } from "@/lib/validation/mentorship";
import { changeMentorshipOffer, saveMentorshipOffer, updateMentorshipApplication } from "@/server/actions/mentorship.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { MentorshipService } from "@/server/services/mentorship.service";
import { applicationStatuses, mentorshipStatuses, type MentorshipApplication } from "@/types/domain/mentorship";

export type MentorshipAdminSearch = Promise<{ application?: string; status?: string; error?: string; saved?: string; deleted?: string; application_saved?: string }>;
const errors: Record<string, string> = {
  validation: "Проверьте обязательные поля RU/KK и количество мест.", forbidden: "Недостаточно прав.",
  invalid_reference: "Наставник должен иметь верифицированный профиль с обеими языковыми версиями, направление должно быть активно.",
  invalid_transition: "Этот переход статуса недоступен.", not_found: "Запись недоступна.", not_available: "Для принятия заявки опубликуйте предложение и проверьте доступность наставника.",
  capacity_exceeded: "Все места заняты или новый лимит меньше числа принятых заявок.",
  mentor_has_applications: "Сначала рассмотрите новые заявки и завершите активное наставничество. Затем можно удалить предложение или заменить наставника.",
  confirm_delete: "Подтвердите удаление.", action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug и повторите попытку.",
};
async function managerAccess() {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageMentorship(access.access)) notFound();
  return access.access;
}
function Notice({ state }: { state: Awaited<MentorshipAdminSearch> }) {
  return <>{state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? errors.action_failed}</div> : null}
    {state.saved === "1" || state.application_saved === "1" ? <div className="notice success-notice">Изменения сохранены.</div> : null}
    {state.deleted === "1" ? <div className="notice success-notice">Предложение перенесено в удалённые.</div> : null}</>;
}
export async function MentorshipAdminList({ searchParams }: { searchParams: MentorshipAdminSearch }) {
  const access = await managerAccess(); if (!access) return null;
  const state = await searchParams;
  const parsed = mentorshipStatusSchema.safeParse(state.status);
  const status = parsed.success ? parsed.data : "all";
  const offers = await new MentorshipService().list(access, status);
  return <div className="content-page"><div className="page-heading media-page-heading"><div><p className="page-kicker">Программы</p><h1>Наставничество</h1><p>Наставники, условия участия и заявки молодых исследователей.</p></div><div className="heading-actions"><Link className="secondary-button" href={base + "/applications"}>Все заявки</Link><Link className="primary-button" href={base + "/new"}>Добавить предложение</Link></div></div>
    <Notice state={state} /><section className="media-toolbar"><form className="media-filters" action={base}><select name="status" aria-label="Статус" defaultValue={status}><option value="all">Все статусы</option>{mentorshipStatuses.map(value => <option key={value} value={value}>{mentorshipStatusLabels[value]}</option>)}</select><button className="secondary-button">Применить</button></form><span className="real-count">{offers.length} записей · до 100 последних</span></section>
    <section className="data-panel">{offers.length ? <div className="table-wrap"><table className="articles-table"><thead><tr><th>Предложение</th><th>Наставник</th><th>Формат</th><th>Мест</th><th>Статус</th></tr></thead><tbody>{offers.map(offer => <tr key={offer.id}><td><Link href={base + "/" + offer.id}>{offer.translations.find(t => t.locale === "ru")?.title ?? "Без названия"}</Link><small>{offer.field?.nameRu ?? "—"}</small></td><td>{offer.mentor.find(t => t.locale === "ru")?.fullName ?? "Профиль недоступен"}</td><td>{mentorshipFormatLabels.ru[offer.format]}</td><td>{offer.capacity}</td><td><span className={"status-badge status-" + offer.status}>{mentorshipStatusLabels[offer.status]}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>Предложения не найдены</h3><p>Добавьте наставника или измените фильтр.</p></div>}</section>
  </div>;
}
function ApplicationCard({ application, queue = false }: { application: MentorshipApplication; queue?: boolean }) {
  return <article className="article-editor-panel mentorship-application"><div className="panel-title"><div><h3>{application.fullName}</h3><p>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" }).format(new Date(application.createdAt))} · {application.locale.toUpperCase()}</p></div><span className="status-badge">{applicationStatusLabels[application.status]}</span></div>
    <a href={"mailto:" + application.email}>{application.email}</a><p className="mentorship-motivation">{application.motivation}</p><p className="field-hint">Согласие на обработку заявки получено {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(application.consentAt))}.</p>
    <form className="translation-fields" action={updateMentorshipApplication.bind(null, application.id, application.offerId)}>
      <input type="hidden" name="returnTo" value={queue ? "queue" : "offer"} />
      <label>Статус<select name="status" defaultValue={application.status}>{applicationStatuses.filter(value => canChangeApplicationStatus(application.status, value)).map(value => <option key={value} value={value}>{applicationStatusLabels[value]}</option>)}</select></label>
      <label>Внутренняя заметка<textarea name="note" defaultValue={application.managerNote} rows={3} maxLength={5000} /></label><div><SubmitButton label="Сохранить заявку" /></div>
    </form>
  </article>;
}
export async function MentorshipAdminEditor({ id, searchParams }: { id?: string; searchParams: MentorshipAdminSearch }) {
  const access = await managerAccess(); if (!access) return null;
  if (id && !z.uuid().safeParse(id).success) notFound();
  const service = new MentorshipService();
  const offer = id ? await service.getById(access, id) : undefined;
  if (id && !offer) notFound();
  const [state, options, applications] = await Promise.all([searchParams, service.options(access), id ? service.applications(access, id) : Promise.resolve([])]);
  return <div className="content-page"><Link className="back-link" href={base}>← Наставничество</Link><div className="media-detail-heading"><div><p className="page-kicker">Программы</p><h1>{offer?.translations.find(t => t.locale === "ru")?.title ?? "Новое предложение"}</h1><p>Сохраните обе языковые версии и опубликуйте предложение для приёма заявок.</p></div></div><Notice state={state} />
    {offer ? <section className="workflow-panel"><div><h2>{mentorshipStatusLabels[offer.status]}</h2><p>В архиве новые заявки не принимаются. Существующие заявки сохраняются.</p>{offer.status === "published" ? <div className="heading-actions">{offer.translations.map(t => <Link key={t.locale} href={"/" + t.locale + "/mentorship/" + t.slug} target="_blank">Открыть {t.locale.toUpperCase()}</Link>)}</div> : null}</div><div className="workflow-actions">{mentorshipStatuses.filter(value => canChangeMentorshipStatus(offer.status, value)).map(value => <form key={value} action={changeMentorshipOffer.bind(null, offer.id, value)}><button className={value === "published" ? "primary-button" : "secondary-button"}>{value === "published" ? "Опубликовать" : value === "draft" ? "В черновики" : "В архив"}</button></form>)}</div></section> : null}
    <MentorshipForm action={saveMentorshipOffer.bind(null, offer?.id ?? null)} offer={offer ?? undefined} options={options} />
    {offer ? <><section className="mentorship-applications" id="applications"><div className="media-detail-heading"><div><h2>Заявки на участие</h2><p>До 100 последних заявок. Связывайтесь с заявителем по email; заметки видны только менеджерам.</p></div><Link href={base + "/applications"}>Все заявки и фильтры</Link></div>{applications.length ? applications.map(item => <ApplicationCard key={item.id} application={item} />) : <div className="empty-state"><p>Заявок пока нет.</p></div>}</section>
      <section className="danger-zone"><div><h2>Удалить предложение</h2><p>Доступно после рассмотрения заявок и завершения активного наставничества.</p></div><form action={changeMentorshipOffer.bind(null, offer.id, "delete")}><label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю действие</label><button className="danger-button">Удалить</button></form></section></> : null}
  </div>;
}
export async function MentorshipApplicationQueue({ searchParams }: { searchParams: MentorshipAdminSearch }) {
  const access = await managerAccess(); if (!access) return null;
  const state = await searchParams;
  const parsed = applicationStatusSchema.safeParse(state.status);
  const status = parsed.success ? parsed.data : "all";
  if (state.application && !z.uuid().safeParse(state.application).success) notFound();
  const applications = await new MentorshipService().applications(access, undefined, status, state.application);
  return <div className="content-page"><Link className="back-link" href={base}>← Наставничество</Link><div className="page-heading"><div><p className="page-kicker">Наставничество</p><h1>Заявки на участие</h1><p>До 100 последних заявок по выбранному статусу.</p></div></div><Notice state={state} />
    <section className="media-toolbar"><form className="media-filters"><select name="status" defaultValue={status} aria-label="Статус заявки"><option value="all">Все статусы</option>{applicationStatuses.map(value => <option key={value} value={value}>{applicationStatusLabels[value]}</option>)}</select><button className="secondary-button">Применить</button></form></section>
    {applications.length ? <div className="mentorship-applications">{applications.map(application => <div key={application.id}><Link className="back-link" href={base + "/" + application.offerId + "#applications"}>Открыть предложение →</Link><ApplicationCard application={application} queue /></div>)}</div> : <div className="empty-state"><h2>Заявки не найдены</h2><p>Измените фильтр или дождитесь новых заявок.</p></div>}
  </div>;
}
