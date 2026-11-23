import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  FileText,
  FlaskConical,
  Layers,
  Plus,
  Search,
} from "lucide-react";
import { getAdminAccess } from "@/server/services/access.service";
import { canEditOutputs, ResearchOutputService } from "@/server/services/research-output.service";
import { saveResearchOutput } from "@/server/actions/research-output.actions";
import {
  researchOutputKinds,
  researchOutputLabels,
  type ResearchOutputKind,
} from "@/types/domain/research-output";
import { ResearchOutputForm } from "./ResearchOutputForm";
import { defaultLocale } from "@/lib/i18n/locales";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  kind?: string;
  saved?: string;
  created?: string;
  error?: string;
}>;

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "В архиве",
};

const errors: Record<string, string> = {
  validation: "Проверьте обязательные поля (название, описание, версия, лицензия и хотя бы одна работа).",
  forbidden: "Недостаточно прав для выполнения операции.",
  stale_version: "Результат уже изменён в другой вкладке. Обновите страницу перед сохранением.",
  not_found: "Научный результат не найден.",
  action_failed: "Не удалось сохранить результат. Проверьте данные и доступность файлов.",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

export async function ResearchOutputAdminList({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditOutputs(result.access)) notFound();

  const state = await searchParams;
  const query = (state.q ?? "").trim().toLowerCase();
  const statusFilter = state.status ?? "all";
  const kindFilter = state.kind ?? "all";

  const service = new ResearchOutputService();
  const [allOutputs, workOptions] = await Promise.all([
    service.list(result.access),
    service.workOptions(result.access),
  ]);

  const workMap = new Map(workOptions.map((w) => [w.id, w.title]));

  const filtered = allOutputs.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    if (query) {
      const matchRu = item.input.ru.title.toLowerCase().includes(query);
      const matchKk = item.input.kk.title.toLowerCase().includes(query);
      const matchEn = (item.input.en?.title ?? "").toLowerCase().includes(query);
      const matchDesc = item.input.ru.description.toLowerCase().includes(query);
      const matchWorks = item.input.workIds.some((wId) =>
        (workMap.get(wId) ?? "").toLowerCase().includes(query)
      );
      if (!matchRu && !matchKk && !matchEn && !matchDesc && !matchWorks) return false;
    }
    return true;
  });

  const basePath = "/admin/science/results";

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Наука</span>
        <span>/</span>
        <strong>Научные результаты</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Научная деятельность</p>
          <h1>Научные результаты</h1>
          <p>Данные, отчёты, карты, методики и инструменты исследований.</p>
        </div>
        <div className="heading-actions">
          <Link className="primary-button" href={`${basePath}/new`}>
            <Plus aria-hidden="true" size={16} />
            <span>Добавить результат</span>
          </Link>
        </div>
      </div>

      {state.created === "1" ? (
        <div className="notice success-notice">Научный результат успешно создан.</div>
      ) : null}
      {state.saved === "1" ? (
        <div className="notice success-notice">Новая версия результата сохранена.</div>
      ) : null}
      {state.error ? (
        <div role="alert" className="notice error-notice">
          {errors[state.error] ?? errors.action_failed}
        </div>
      ) : null}

      <section className="media-toolbar" aria-label="Фильтры результатов">
        <form action={basePath} className="media-filters">
          <label className="search-field">
            <Search aria-hidden="true" size={16} />
            <span className="visually-hidden">Поиск по названию или описанию</span>
            <input
              type="search"
              name="q"
              defaultValue={state.q ?? ""}
              placeholder="Поиск по названию, описанию или связанной работе"
              maxLength={120}
            />
          </label>
          <select name="status" defaultValue={statusFilter} aria-label="Статус">
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="published">Опубликован</option>
            <option value="archived">В архиве</option>
          </select>
          <select name="kind" defaultValue={kindFilter} aria-label="Тип результата">
            <option value="all">Все типы</option>
            {researchOutputKinds.map((k) => (
              <option key={k} value={k}>
                {researchOutputLabels.ru[k]}
              </option>
            ))}
          </select>
          <button className="secondary-button" type="submit">
            Применить
          </button>
        </form>
        <span className="real-count">
          {filtered.length}{" "}
          {filtered.length === 1
            ? "запись"
            : filtered.length > 1 && filtered.length < 5
            ? "записи"
            : "записей"}
        </span>
      </section>

      <section className="data-panel" aria-labelledby="results-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="results-table-title">Каталог научных результатов</h2>
            <p>
              На публичном сайте отображаются только опубликованные результаты со связанными опубликованными исследованиями.
            </p>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Связанные работы</th>
                  <th>Файлы</th>
                  <th>Версия / Лицензия</th>
                  <th>Статус</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const linkedWorks = item.input.workIds
                    .map((id) => workMap.get(id))
                    .filter(Boolean);
                  const publicFilesCount = item.input.files.filter((f) => f.isPublic).length;
                  const totalFilesCount = item.input.files.length;

                  return (
                    <tr key={item.id}>
                      <td>
                        <Link href={`${basePath}/${item.id}`} style={{ fontWeight: 600 }}>
                          {item.input.ru.title || item.input.kk.title}
                        </Link>
                        <small style={{ color: "#64748b", display: "block", marginTop: "2px" }}>
                          {item.input.ru.description.slice(0, 80)}
                          {item.input.ru.description.length > 80 ? "…" : ""}
                        </small>
                      </td>
                      <td>
                        <span className="stage-badge">
                          {researchOutputLabels.ru[item.kind]}
                        </span>
                      </td>
                      <td>
                        {linkedWorks.length ? (
                          <div>
                            <span style={{ fontSize: "13px" }}>{linkedWorks[0]}</span>
                            {linkedWorks.length > 1 ? (
                              <small style={{ color: "#64748b", display: "block" }}>
                                + ещё {linkedWorks.length - 1}
                              </small>
                            ) : null}
                          </div>
                        ) : (
                          <span style={{ color: "#e11d48", fontSize: "12px" }}>Не привязано</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: "12px" }}>
                          <span>{totalFilesCount} {totalFilesCount === 1 ? "файл" : "файлов"}</span>
                          {publicFilesCount > 0 ? (
                            <small style={{ color: "#16a34a", display: "block" }}>
                              {publicFilesCount} публ.
                            </small>
                          ) : (
                            <small style={{ color: "#64748b", display: "block" }}>
                              закрытый доступ
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: "13px" }}>
                          v{item.input.versionLabel}
                        </span>
                        <small style={{ color: "#64748b", display: "block" }}>
                          {item.input.license}
                        </small>
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
            <FlaskConical
              size={42}
              aria-hidden="true"
              style={{ color: "#94a3b8", margin: "0 auto 12px" }}
            />
            <h3>Научные результаты не найдены</h3>
            <p>Добавьте результат или измените параметры поиска и фильтрации.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export async function ResearchOutputAdminEditor({
  id,
  searchParams,
}: {
  id?: string;
  searchParams: SearchParams;
}) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditOutputs(result.access)) notFound();

  if (id && !z.uuid().safeParse(id).success) notFound();

  const service = new ResearchOutputService();
  const [state, current] = await Promise.all([
    searchParams,
    id ? service.get(result.access, id) : Promise.resolve(null),
  ]);

  if (id && !current) notFound();

  const input = current?.versions?.[0]?.input;

  const [uploads, options, selected] = await Promise.all([
    service.uploads(result.access, input?.files.map((f) => f.id)),
    service.workOptions(result.access),
    input?.workIds.length
      ? service.workOptions(result.access, "", input.workIds)
      : Promise.resolve([]),
  ]);

  const works = [...new Map([...options, ...selected].map((w) => [w.id, w])).values()];
  const basePath = "/admin/science/results";
  const title = current ? input?.ru.title || input?.kk.title : "Новый результат";

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href={basePath}>Научные результаты</Link>
        <span>/</span>
        <strong>{current ? `Редактирование · v${current.version}` : "Создание"}</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Научная деятельность</p>
          <h1>{title}</h1>
          <p>
            {current
              ? `Управление версиями и материалами результата (текущая версия: ${current.version}).`
              : "Заполните сведения о научном результате, привяжите исследования и прикрепите файлы."}
          </p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={basePath}>
            <ArrowLeft aria-hidden="true" size={16} />
            <span>Назад к списку</span>
          </Link>
          {current && current.status === "published" ? (
            <Link
              className="secondary-button"
              href={`/${defaultLocale}/results/${current.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <span>На сайте</span>
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          ) : null}
        </div>
      </div>

      {state.created === "1" ? (
        <div className="notice success-notice">Научный результат успешно создан.</div>
      ) : null}
      {state.saved === "1" ? (
        <div className="notice success-notice">Новая версия результата сохранена.</div>
      ) : null}
      {state.error ? (
        <div role="alert" className="notice error-notice">
          {errors[state.error] ?? errors.action_failed}
        </div>
      ) : null}

      <ResearchOutputForm
        action={saveResearchOutput}
        current={current}
        initialWorks={works}
        initialUploads={uploads}
      />
    </div>
  );
}
