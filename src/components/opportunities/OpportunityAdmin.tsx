import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, Compass, Plus, Search } from "lucide-react";
import { Pagination } from "@/components/search/Pagination";
import { SubmitButton } from "@/components/science/SubmitButton";
import { opportunityTypeLabels, opportunityErrorMessage } from "@/lib/i18n/opportunity";
import type { PublicQuery } from "@/lib/i18n/locales";
import { readPage } from "@/lib/search";
import { opportunityAdminPath, opportunityFiltersSchema, opportunityStatuses } from "@/lib/validation/opportunity";
import { changeOpportunityStatus, saveOpportunity } from "@/server/actions/opportunity.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { canManageOpportunities, OpportunityService } from "@/server/services/opportunity.service";
import { OpportunityForm } from "./OpportunityForm";

export type OpportunityAdminSearch = Promise<PublicQuery>;
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });
const statuses = { draft: "Черновик", published: "Опубликовано", archived: "В архиве" };
export async function OpportunityAdminList({ searchParams }: { searchParams: OpportunityAdminSearch }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canManageOpportunities(result.access)) notFound();
  const state = await searchParams;
  const parsed = opportunityFiltersSchema.safeParse({ q: state.q ?? "", status: state.status ?? "all", availability: "all" });
  const filters = parsed.success ? parsed.data : opportunityFiltersSchema.parse({ availability: "all" });
  const data = await new OpportunityService().list(result.access, filters, readPage(state.page));
  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Контент</span><span>/</span><strong>Возможности</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Контент</p>
          <h1>Возможности</h1>
          <p>Гранты, конкурсы, стажировки и открытые наборы.</p>
        </div>
        <div className="heading-actions">
          <Link className="primary-button" href={opportunityAdminPath + "/new"}>
            <Plus aria-hidden="true" />Добавить возможность
          </Link>
        </div>
      </div>

      <section className="media-toolbar" aria-label="Фильтры возможностей">
        <form className="media-filters" action={opportunityAdminPath}>
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="visually-hidden">Поиск по названию</span>
            <input
              name="q"
              type="search"
              aria-label="Поиск возможностей"
              placeholder="Найти по названию"
              defaultValue={filters.q}
              maxLength={120}
            />
          </label>
          <label>
            <span className="visually-hidden">Статус</span>
            <select name="status" aria-label="Статус" defaultValue={filters.status}>
              <option value="all">Все статусы</option>
              {opportunityStatuses.map((s) => (
                <option key={s} value={s}>{statuses[s]}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="secondary-button">Применить</button>
        </form>
        <span className="real-count">Найдено: {data.total}</span>
      </section>

      <section className="data-panel" aria-labelledby="opportunities-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="opportunities-table-title">Все материалы</h2>
            <p>Гранты, стажировки, конкурсы и программы поддержки.</p>
          </div>
        </div>
        {data.items.length > 0 ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Организация</th>
                  <th>Страна / Дедлайн</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const translation = item.translations.find((t) => t.locale === "ru") ?? item.translations[0];
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link href={opportunityAdminPath + "/" + item.id}>{translation?.title ?? "Без названия"}</Link>
                        <small>RU / KK / EN</small>
                      </td>
                      <td>{opportunityTypeLabels.ru[item.type]}</td>
                      <td>{translation?.organization || "—"}</td>
                      <td>
                        {item.country || "—"}
                        {item.deadline ? <small>до {dateFormatter.format(new Date(item.deadline))}</small> : null}
                      </td>
                      <td><span className={`status-badge status-${item.status}`}>{statuses[item.status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><Compass aria-hidden="true" /></span>
            <h3>{filters.q ? "Ничего не найдено" : "Возможностей пока нет"}</h3>
            <p>{filters.q ? "Измените поисковый запрос или фильтр статуса." : "Добавьте первую возможность для молодых учёных."}</p>
          </div>
        )}
      </section>

      <Pagination {...data} path={opportunityAdminPath} query={state} locale="ru" />
    </div>
  );
}
export async function OpportunityAdminEditor({ id, searchParams }: { id?: string; searchParams: OpportunityAdminSearch }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canManageOpportunities(result.access) || (id && !z.uuid().safeParse(id).success)) notFound();
  const item = id ? (await new OpportunityService().list(result.access, opportunityFiltersSchema.parse({ availability: "all" }), 1, id)).items[0] : undefined;
  if (id && !item) notFound();
  const state = await searchParams;
  const error = typeof state.error === "string" ? state.error : "";
  return <div className="content-page">
    <Link className="back-link" href={opportunityAdminPath}><ArrowLeft aria-hidden="true" />Все возможности</Link>
    <div className="page-heading media-detail-heading article-detail-heading">
      <div>
        <p className="page-kicker">Управление возможностями</p>
        <h1>{item?.translations.find(t => t.locale === "ru")?.title ?? "Новая возможность"}</h1>
        <p>{item ? `${statuses[item.status]} · ${opportunityTypeLabels.ru[item.type]}` : "Правки сохраняются в черновик. Перед публикацией проверьте RU/KK и первоисточник."}</p>
      </div>
      {item ? <span className={`status-badge status-${item.status}`}>{statuses[item.status]}</span> : null}
    </div>
    {error && <p role="alert" className="notice error-notice">{opportunityErrorMessage(error)}</p>}
    {state.saved === "1" && <p role="status" className="notice success-notice">Изменения сохранены.</p>}
    {item && <section className="workflow-panel"><div><h2>{statuses[item.status]}</h2><p>Архив скрывает возможность с сайта. Истёкший срок отображается отдельно.</p>{item.status === "published" && item.translations.map(t => <Link key={t.locale} href={`/${t.locale}/opportunities/${t.slug}`} target="_blank">Открыть {t.locale.toUpperCase()} </Link>)}</div><div className="workflow-actions">{opportunityStatuses.filter(s => s !== item.status && (item.status !== "archived" || s === "draft")).map(s => <form key={s} action={changeOpportunityStatus.bind(null, item.id, item.version!, s)}><SubmitButton label={s === "published" ? "Опубликовать" : s === "draft" ? "В черновики" : "В архив"} /></form>)}</div></section>}
    <OpportunityForm opportunity={item} action={saveOpportunity.bind(null, item?.id ?? null, item?.version ?? null)} />
  </div>;
}
