import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ArrowUpRight, BookOpenText, ExternalLink, Plus, Search } from "lucide-react";
import { hasPermission } from "@/lib/permissions/permissions";
import { getAdminAccess } from "@/server/services/access.service";
import { PublicationService } from "@/server/services/publication.service";
import { ArticleRelationsService } from "@/server/services/article-relations.service";
import { MediaService } from "@/server/services/media.service";
import { savePublication } from "@/server/actions/publication.actions";
import {
  publicationTypes,
  publicationTypeLabels,
  type Publication,
  type PublicationType,
} from "@/types/domain/publication";
import { PublicationForm } from "./PublicationForm";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  type?: string;
  saved?: string;
  created?: string;
  error?: string;
}>;

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликована",
  archived: "В архиве",
};

const errors: Record<string, string> = {
  validation: "Проверьте обязательные поля (название, журнал, год, автор). Связи не должны повторяться.",
  forbidden: "Недостаточно прав для выполнения операции.",
  stale_version: "Запись была изменена в другой вкладке. Обновите страницу.",
  not_found: "Публикация не найдена.",
  action_failed: "Не удалось сохранить публикацию. Проверьте данные и повторите попытку.",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

export async function PublicationAdminList({ searchParams }: { searchParams: SearchParams }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!hasPermission(result.access, "publications.manage")) notFound();

  const state = await searchParams;
  const query = (state.q ?? "").trim().toLowerCase();
  const statusFilter = state.status ?? "all";
  const typeFilter = state.type ?? "all";

  const [allPublications, scientists] = await Promise.all([
    new PublicationService().list(result.access),
    new ArticleRelationsService().search(result.access, "scientist"),
  ]);

  const scientistMap = new Map(scientists.map((s) => [s.entityId, s.titleRu]));

  const filtered = allPublications.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (typeFilter !== "all" && item.publicationType !== typeFilter) return false;
    if (query) {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchJournal = item.journal.toLowerCase().includes(query);
      const matchDoi = (item.doi ?? "").toLowerCase().includes(query);
      const matchAuthor = (scientistMap.get(item.scientistId) ?? "").toLowerCase().includes(query);
      if (!matchTitle && !matchJournal && !matchDoi && !matchAuthor) return false;
    }
    return true;
  });

  const basePath = "/admin/science/publications";

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Наука</span>
        <span>/</span>
        <strong>Научные публикации</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Научная деятельность</p>
          <h1>Научные публикации</h1>
          <p>Публикации в научных журналах, сборниках конференций и монографиях.</p>
        </div>
        <div className="heading-actions">
          <Link className="primary-button" href={`${basePath}/new`}>
            <Plus aria-hidden="true" size={16} />
            <span>Добавить публикацию</span>
          </Link>
        </div>
      </div>

      {state.created === "1" ? <div className="notice success-notice">Публикация успешно создана.</div> : null}
      {state.saved === "1" ? <div className="notice success-notice">Публикация сохранена.</div> : null}
      {state.error ? (
        <div role="alert" className="notice error-notice">
          {errors[state.error] ?? errors.action_failed}
        </div>
      ) : null}

      <section className="media-toolbar" aria-label="Фильтры публикаций">
        <form action={basePath} className="media-filters">
          <label className="search-field">
            <Search aria-hidden="true" size={16} />
            <span className="visually-hidden">Поиск по названию или изданию</span>
            <input
              type="search"
              name="q"
              defaultValue={state.q ?? ""}
              placeholder="Поиск по названию, изданию, DOI или автору"
              maxLength={120}
            />
          </label>
          <select name="status" defaultValue={statusFilter} aria-label="Статус">
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="published">Опубликована</option>
            <option value="archived">В архиве</option>
          </select>
          <select name="type" defaultValue={typeFilter} aria-label="Тип публикации">
            <option value="all">Все типы</option>
            {publicationTypes.map((type) => (
              <option key={type} value={type}>
                {publicationTypeLabels.ru[type]}
              </option>
            ))}
          </select>
          <button className="secondary-button" type="submit">
            Применить
          </button>
        </form>
        <span className="real-count">
          {filtered.length} {filtered.length === 1 ? "запись" : filtered.length > 1 && filtered.length < 5 ? "записи" : "записей"}
        </span>
      </section>

      <section className="data-panel" aria-labelledby="publications-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="publications-table-title">Каталог научных публикаций</h2>
            <p>На публичном сайте отображаются только опубликованные материалы с верифицированными авторами.</p>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Основной автор</th>
                  <th>Журнал / Год</th>
                  <th>DOI / Ссылка</th>
                  <th>Статус</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const authorName = scientistMap.get(item.scientistId) ?? "—";
                  const coauthorsCount = item.coauthors.length;
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link href={`${basePath}/${item.id}`} style={{ fontWeight: 600 }}>
                          {item.title}
                        </Link>
                        <small style={{ color: "#64748b", display: "block", marginTop: "2px" }}>
                          {item.journal} · {item.year}
                        </small>
                      </td>
                      <td>
                        <span className="stage-badge">
                          {publicationTypeLabels.ru[item.publicationType]}
                        </span>
                      </td>
                      <td>
                        <span>{authorName}</span>
                        {coauthorsCount > 0 ? (
                          <small style={{ color: "#64748b", display: "block" }}>
                            +{coauthorsCount} {coauthorsCount === 1 ? "соавтор" : "соавторов"}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <span>{item.journal}</span>
                        <small style={{ color: "#64748b", display: "block" }}>{item.year}</small>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {item.doi ? (
                            <a
                              href={`https://doi.org/${item.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", color: "var(--forest-bright)" }}
                            >
                              <span>DOI</span>
                              <ExternalLink size={10} aria-hidden="true" />
                            </a>
                          ) : null}
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", color: "var(--forest-bright)" }}
                            >
                              <span>Источник</span>
                              <ExternalLink size={10} aria-hidden="true" />
                            </a>
                          ) : null}
                          {!item.doi && !item.url ? <span>—</span> : null}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge status-${item.status}`}>
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td>
                        {dateFormatter.format(new Date(item.updatedAt))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <BookOpenText size={42} aria-hidden="true" style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
            <h3>Публикации не найдены</h3>
            <p>Добавьте публикацию или измените параметры поиска и фильтрации.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export async function PublicationAdminEditor({
  id,
  searchParams,
}: {
  id?: string;
  searchParams: SearchParams;
}) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!hasPermission(result.access, "publications.manage")) notFound();

  if (id && !z.uuid().safeParse(id).success) notFound();

  const [state, scientists, media] = await Promise.all([
    searchParams,
    new ArticleRelationsService().search(result.access, "scientist"),
    new MediaService().list(result.access, { query: "", type: "document", bucket: "publication-files" }),
  ]);

  const current = id ? await new PublicationService().getById(result.access, id) : null;
  if (id && !current) notFound();

  const selectedScientist =
    current && !scientists.some((item) => item.entityId === current.scientistId)
      ? (await new ArticleRelationsService().search(result.access, "scientist", "", [current.scientistId]))[0]
      : undefined;

  const options = selectedScientist ? [...scientists, selectedScientist] : scientists;
  const relations = new ArticleRelationsService();
  const coauthorIds = current?.coauthors.flatMap((a) => (a.scientistId ? [a.scientistId] : [])) ?? [];

  const [coauthorOptions, researchOptions, projectOptions] = await Promise.all([
    coauthorIds.length ? relations.search(result.access, "scientist", "", coauthorIds) : Promise.resolve([]),
    relations.search(result.access, "research"),
    relations.search(result.access, "project"),
  ]);

  const selectedWorks = current?.workIds.length
    ? (
        await Promise.all([
          relations.search(result.access, "research", "", current.workIds),
          relations.search(result.access, "project", "", current.workIds),
        ])
      ).flat()
    : [];

  const authorOptions = [...new Map([...options, ...coauthorOptions].map((o) => [o.entityId, o])).values()];
  const workOptions = [
    ...new Map([...researchOptions, ...projectOptions, ...selectedWorks].map((o) => [o.entityId, o])).values(),
  ];

  const basePath = "/admin/science/publications";

  return (
    <div className="content-page">
      <Link className="back-link" href={basePath}>
        <ArrowLeft aria-hidden="true" size={16} />
        <span>Научные публикации</span>
      </Link>

      <div className="media-detail-heading">
        <div>
          <p className="page-kicker">Научные публикации</p>
          <h1>{current ? current.title : "Новая научная публикация"}</h1>
          <p>
            {current
              ? "Редактирование библиографической записи, авторского коллектива и связей с исследованиями."
              : "Внесение новой публикации в научный каталог региона."}
          </p>
        </div>
        {current ? (
          <span className={`status-badge status-${current.status}`}>{statusLabels[current.status]}</span>
        ) : null}
      </div>

      {state.saved === "1" ? <div className="notice success-notice">Публикация сохранена.</div> : null}
      {state.created === "1" ? <div className="notice success-notice">Публикация успешно создана.</div> : null}
      {state.error ? (
        <div role="alert" className="notice error-notice">
          {errors[state.error] ?? errors.action_failed}
        </div>
      ) : null}

      {current && current.status === "published" ? (
        <section className="workflow-panel">
          <div>
            <h2>Опубликованная запись</h2>
            <p>Публикация видна в каталоге платформы и в профиле привязанного учёного.</p>
            <div className="heading-actions" style={{ marginTop: "8px" }}>
              <Link href={`/ru/publications/${current.id}`} target="_blank" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span>Открыть на сайте</span>
                <ExternalLink size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <PublicationForm
        action={savePublication}
        publication={current}
        media={media}
        scientistOptions={options}
        authorOptions={authorOptions}
        workOptions={workOptions}
      />
    </div>
  );
}
