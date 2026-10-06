import { localizedPath } from "@/lib/i18n/locales";
import { ArrowLeft, Plus, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ScienceWorkForm } from "./ScienceWorkForm";
import { canViewMedia } from "@/lib/permissions/permissions";
import { canChangeScienceWorkStatus, canManageScienceWork, scienceWorkAdminPath, scienceWorkPath, scienceWorkStageLabels, scienceWorkStatusLabels, scienceWorkTitles } from "@/lib/science-work";
import { scienceWorkListFiltersSchema } from "@/lib/validation/science-work";
import { changeScienceWorkStatus, deleteScienceWork, saveScienceWork } from "@/server/actions/science-work.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { MediaService } from "@/server/services/media.service";
import { ScienceWorkService } from "@/server/services/science-work.service";
import { scienceWorkStatuses, type ScienceWorkKind } from "@/types/domain/science-work";

type SearchParams = Promise<{ q?: string; status?: string; error?: string; deleted?: string; created?: string; saved?: string; status_changed?: string }>;
const errors: Record<string, string> = {
  validation: "Проверьте обязательные RU/KK-поля, сроки, ссылки и DOI. Не отмечайте руководителя повторно среди участников.",
  forbidden: "Недостаточно прав для этого действия.",
  invalid_reference: "Направление, организация, обложка или участник недоступны. Участники должны иметь верифицированные профили.",
  invalid_transition: "Это изменение статуса недоступно.",
  not_found: "Запись больше недоступна.",
  confirm_delete: "Подтвердите удаление записи.",
  action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug и повторите попытку.",
};

export async function ScienceWorkAdminList({ kind, searchParams }: { kind: ScienceWorkKind; searchParams: SearchParams }) {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageScienceWork(access.access, kind)) notFound();
  const state = await searchParams;
  const parsed = scienceWorkListFiltersSchema.safeParse({ query: state.q ?? "", status: state.status ?? "all" });
  const filters = parsed.success ? parsed.data : scienceWorkListFiltersSchema.parse({});
  const works = await new ScienceWorkService().list(access.access, kind, filters);
  const base = scienceWorkAdminPath(kind);
  return <div className="content-page">
    <nav className="breadcrumbs" aria-label="Хлебные крошки"><span>Наука</span><span>/</span><strong>{scienceWorkTitles.ru[kind]}</strong></nav>
    <div className="page-heading media-page-heading"><div><p className="page-kicker">Научная деятельность</p><h1>{scienceWorkTitles.ru[kind]}</h1><p>Двуязычные описания, команды, сроки и результаты научных работ.</p></div><Link className="primary-button" href={base + "/new"}><Plus aria-hidden="true" />Добавить запись</Link></div>
    {state.deleted === "1" ? <div className="notice success-notice">Запись перенесена в удалённые.</div> : null}
    {state.error ? <div role="alert" className="notice error-notice">{errors[state.error] ?? errors.action_failed}</div> : null}
    <section className="media-toolbar"><form action={base} className="media-filters"><label className="search-field"><Search aria-hidden="true" /><span className="visually-hidden">Поиск по названию</span><input type="search" name="q" defaultValue={filters.query} placeholder="Поиск по названию" maxLength={120} /></label><select name="status" defaultValue={filters.status} aria-label="Статус"><option value="all">Все статусы</option>{scienceWorkStatuses.map(status => <option key={status} value={status}>{scienceWorkStatusLabels[status]}</option>)}</select><button className="secondary-button" type="submit">Применить</button></form><span className="real-count">{works.length} записей · до 100 последних</span></section>
    <section className="data-panel"><div className="data-panel-header"><div><h2>Каталог научных работ</h2><p>На публичном сайте видны только опубликованные записи.</p></div></div>
      {works.length ? <div className="table-wrap"><table className="articles-table"><thead><tr><th>Название</th><th>Направление</th><th>Этап</th><th>Статус</th><th>Обновлено</th></tr></thead><tbody>{works.map(work => <tr key={work.id}><td><Link href={base + "/" + work.id}>{work.translations.find(item => item.locale === "ru")?.title ?? "Без названия"}</Link><small>{work.organization?.nameRu ?? "—"}</small></td><td>{work.field?.nameRu ?? "—"}</td><td>{scienceWorkStageLabels.ru[work.stage]}</td><td><span className={"status-badge status-" + work.status}>{scienceWorkStatusLabels[work.status]}</span></td><td>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(work.updatedAt))}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>Записи не найдены</h3><p>Добавьте научную работу или измените фильтры.</p></div>}
    </section>
  </div>;
}

export async function ScienceWorkAdminEditor({ kind, id, searchParams }: { kind: ScienceWorkKind; id?: string; searchParams: SearchParams }) {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  if (!canManageScienceWork(access.access, kind)) notFound();
  if (id && !z.uuid().safeParse(id).success) notFound();
  const base = scienceWorkAdminPath(kind);
  const service = new ScienceWorkService();
  const work = id ? await service.getById(access.access, kind, id) : undefined;
  if (id && !work) notFound();
  const [state, options, media] = await Promise.all([
    searchParams, service.options(access.access, kind),
    canViewMedia(access.access) ? new MediaService().list(access.access, { query: "", type: "image" }).then(items => items.filter(item => item.storageBucket === "article-media")) : Promise.resolve([]),
  ]);
  if (work?.coverMediaId && canViewMedia(access.access) && !media.some(item => item.id === work.coverMediaId)) {
    const current = await new MediaService().getById(access.access, work.coverMediaId);
    if (current && !current.asset.deletedAt) media.push(current.asset);
  }
  return <div className="content-page">
    <Link className="back-link" href={base}><ArrowLeft aria-hidden="true" />{scienceWorkTitles.ru[kind]}</Link>
    <div className="media-detail-heading"><div><p className="page-kicker">{scienceWorkTitles.ru[kind]}</p><h1>{work?.translations.find(item => item.locale === "ru")?.title ?? "Новая научная работа"}</h1><p>Сохранение создаёт черновик. Публикуйте запись после проверки обеих языковых версий.</p></div>{work ? <span className={"status-badge status-" + work.status}>{scienceWorkStatusLabels[work.status]}</span> : null}</div>
    {state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? errors.action_failed}</div> : null}
    {state.created === "1" || state.saved === "1" ? <div className="notice success-notice">Черновик сохранён.</div> : null}
    {state.status_changed === "1" ? <div className="notice success-notice">Статус обновлён.</div> : null}
    {work ? <section className="workflow-panel"><div><h2>{scienceWorkStatusLabels[work.status]}</h2><p>Правки возвращают запись в черновики. Архивную запись можно сначала вернуть в черновики.</p>{work.status === "published" ? <div className="heading-actions">{work.translations.map(item => <Link key={item.locale} href={localizedPath(item.locale, scienceWorkPath(kind) + "/" + item.slug)} target="_blank">Открыть {item.locale.toUpperCase()}</Link>)}</div> : null}</div><div className="workflow-actions">{scienceWorkStatuses.filter(status => canChangeScienceWorkStatus(work.status, status)).map(status => <form key={status} action={changeScienceWorkStatus.bind(null, kind, work.id, status)}><button type="submit" className={status === "published" ? "primary-button" : "secondary-button"}>{status === "published" ? "Опубликовать" : status === "draft" ? "Вернуть в черновики" : "В архив"}</button></form>)}</div></section> : null}
    <ScienceWorkForm action={saveScienceWork.bind(null, kind, work?.id ?? null)} work={work ?? undefined} options={options} media={media} />
    {work ? <section className="danger-zone"><div><h2>Перенести в удалённые</h2><p>Запись исчезнет из админки и публичного каталога.</p></div><form action={deleteScienceWork.bind(null, kind, work.id)}><label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю действие</label><button className="danger-button" type="submit">Удалить</button></form></section> : null}
  </div>;
}
