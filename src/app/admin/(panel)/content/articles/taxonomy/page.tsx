import Link from "next/link";
import { hasPermission } from "@/lib/permissions/permissions";
import { createArticleTaxonomy } from "@/server/actions/article.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";
import { ArticleAuthorDirectoryForm, ArticleTaxonomyDirectory } from "@/components/articles/ArticleDirectory";
import { SubmitButton } from "@/components/science/SubmitButton";

export default async function TaxonomyPage({ searchParams }: {
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>;
}) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  const mayManage = hasPermission(result.access, "articles.edit_any");
  const service = new ArticleService();
  const [taxonomy, profiles, state] = await Promise.all([
    service.listTaxonomy(result.access, true), mayManage ? service.listAuthorProfiles(result.access) : Promise.resolve([]), searchParams,
  ]);
  return <div className="content-page">
    <Link className="back-link" href="/admin/content/articles">Назад к статьям</Link>
    <div className="media-detail-heading"><div>
      <p className="page-kicker">Справочники журнала</p><h1>Авторы, категории и типы</h1>
      <p>Двуязычные справочники. Неактивные элементы сохраняются в опубликованных материалах и истории, но недоступны для нового выбора.</p>
    </div></div>
    {state.created === "1" || state.saved === "1" ? <div className="notice success-notice">Изменения сохранены.</div> : null}
    {state.error ? <div className="notice error-notice" role="alert">{state.error === "forbidden" ? "Недостаточно прав." : state.error === "validation" || state.error === "invalid_input" ? "Проверьте обязательные поля и формат адреса." : "Не удалось сохранить. Проверьте уникальность кода и привязки учётной записи."}</div> : null}
    {mayManage ? <>
      <section className="article-editor-panel">
        <h2>Новый элемент справочника</h2>
        <form action={createArticleTaxonomy} className="taxonomy-form">
          <label>Тип<select name="kind"><option value="category">Категория</option><option value="tag">Тег</option><option value="type">Тип материала</option></select></label>
          <label>Постоянный код<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={2} maxLength={160} required /></label>
          <label>Название · RU<input name="nameRu" minLength={2} maxLength={120} required /></label>
          <label>Название · KK<input name="nameKk" minLength={2} maxLength={120} required /></label>
          <SubmitButton label="Создать" />
        </form>
      </section>
      <section className="article-editor-panel"><h2>Новый автор</h2>
        <p>Для внешнего автора учётная запись не нужна. Привязка к пользователю не меняет владельца статьи или его права.</p>
        <ArticleAuthorDirectoryForm profiles={profiles} />
      </section>
    </> : null}
    <div className="taxonomy-grid">
      <ArticleTaxonomyDirectory title="Категории" kind="category" items={taxonomy.categories} mayManage={mayManage} />
      <ArticleTaxonomyDirectory title="Теги" kind="tag" items={taxonomy.tags} mayManage={mayManage} />
      <ArticleTaxonomyDirectory title="Типы материалов" kind="type" items={taxonomy.contentTypes} mayManage={mayManage} />
    </div>
    <section className="article-editor-panel"><h2>Авторы · {taxonomy.authors.length}</h2>
      {taxonomy.authors.map(author => <details key={author.id}>
        <summary>{author.nameRu} / {author.nameKk} · {author.isActive ? "Активен" : "Неактивен"}</summary>
        {mayManage ? <ArticleAuthorDirectoryForm author={author} profiles={profiles} /> : <p>{author.bioRu}</p>}
      </details>)}
      {!taxonomy.authors.length ? <p>Авторы пока не добавлены.</p> : null}
    </section>
  </div>;
}
