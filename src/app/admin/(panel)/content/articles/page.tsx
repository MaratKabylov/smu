import { BookOpenText, Plus, Search, Tags } from "lucide-react";
import Link from "next/link";
import {
  articleContentTypeLabels,
  articleStatusLabels,
} from "@/lib/articles/presentation";
import { canCreateArticle } from "@/lib/permissions/permissions";
import { articleListFiltersSchema } from "@/lib/validation/article";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";
import { articleStatuses } from "@/types/domain/article";

type ArticlesPageProps = {
  searchParams: Promise<{ q?: string; status?: string; deleted?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;

  const params = await searchParams;
  const parsed = articleListFiltersSchema.safeParse({
    query: params.q ?? "",
    status: params.status ?? "all",
  });
  const filters = parsed.success
    ? parsed.data
    : { query: "", status: "all" as const };
  const articles = await new ArticleService().list(result.access, filters);
  const mayCreate = canCreateArticle(result.access);

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Контент</span><span>/</span><strong>Статьи</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Журнал СМУ</p>
          <h1>Статьи</h1>
          <p>Двуязычные материалы и редакционный цикл публикации.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href="/admin/content/articles/taxonomy">
            <Tags aria-hidden="true" />Авторы и справочники
          </Link>
          {mayCreate ? (
            <Link className="primary-button" href="/admin/content/articles/new">
              <Plus aria-hidden="true" />Создать статью
            </Link>
          ) : null}
        </div>
      </div>

      {params.deleted === "1" ? (
        <div className="notice success-notice">Статья перенесена в удалённые.</div>
      ) : null}

      <section className="media-toolbar" aria-label="Фильтры статей">
        <form className="media-filters" action="/admin/content/articles">
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="visually-hidden">Поиск по заголовку</span>
            <input type="search" name="q" defaultValue={filters.query} placeholder="Найти по заголовку" />
          </label>
          <label>
            <span className="visually-hidden">Статус</span>
            <select name="status" defaultValue={filters.status}>
              <option value="all">Все статусы</option>
              {articleStatuses.map((status) => (
                <option value={status} key={status}>{articleStatusLabels[status]}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button" type="submit">Применить</button>
        </form>
        <span className="real-count">{articles.length} материалов</span>
      </section>

      <section className="data-panel" aria-labelledby="articles-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="articles-table-title">Все материалы</h2>
            <p>Доступность списка учитывает роль и авторство.</p>
          </div>
        </div>
        {articles.length > 0 ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Заголовок</th><th>Категории</th><th>Тип</th>
                  <th>Авторы</th><th>Статус</th><th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => {
                  const translation = article.translations.find((item) => item.locale === "ru") ?? article.translations[0];
                  return (
                    <tr key={article.id}>
                      <td>
                        <Link href={`/admin/content/articles/${article.id}`}>{translation?.title ?? "Без заголовка"}</Link>
                        <small>RU / KK</small>
                      </td>
                      <td>{article.categories.map(item => item.nameRu).join(", ") || "—"}</td>
                      <td>{article.contentTypeItem?.nameRu ?? articleContentTypeLabels[article.contentType] ?? article.contentType}</td>
                      <td>{article.authors.map(item => item.nameRu).join(", ") || "—"}<small>Владелец: {article.authorName ?? "Пользователь редакции"}</small></td>
                      <td><span className={`status-badge status-${article.status}`}>{articleStatusLabels[article.status]}</span></td>
                      <td>{dateFormatter.format(new Date(article.updatedAt))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><BookOpenText aria-hidden="true" /></span>
            <h3>{filters.query ? "Ничего не найдено" : "Статей пока нет"}</h3>
            <p>{filters.query ? "Измените поисковый запрос или фильтр статуса." : "Создайте первый двуязычный материал и отправьте его на рецензию."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
