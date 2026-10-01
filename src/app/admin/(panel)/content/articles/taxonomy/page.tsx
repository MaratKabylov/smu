import { ArrowLeft, FolderTree, Plus, Tags } from "lucide-react";
import Link from "next/link";
import { canEditArticle } from "@/lib/permissions/permissions";
import { createArticleTaxonomy } from "@/server/actions/article.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";

type TaxonomyPageProps = {
  searchParams: Promise<{ created?: string; error?: string }>;
};

export default async function TaxonomyPage({ searchParams }: TaxonomyPageProps) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;

  const [taxonomy, state] = await Promise.all([
    new ArticleService().listTaxonomy(result.access, true),
    searchParams,
  ]);
  const mayManage = canEditArticle(result.access);

  return (
    <div className="content-page">
      <Link className="back-link" href="/admin/content/articles">
        <ArrowLeft aria-hidden="true" />Назад к статьям
      </Link>
      <div className="media-detail-heading">
        <div>
          <p className="page-kicker">Справочники журнала</p>
          <h1>Категории и теги</h1>
          <p>Единые двуязычные значения для редакционных материалов.</p>
        </div>
      </div>

      {state.created === "1" ? <div className="notice success-notice">Элемент справочника создан.</div> : null}
      {state.error ? <div className="notice error-notice" role="alert">{state.error === "validation" ? "Проверьте поля и формат slug." : "Не удалось создать элемент. Возможно, slug уже занят."}</div> : null}

      {mayManage ? (
        <section className="article-editor-panel taxonomy-create-panel">
          <div className="panel-title">
            <div><h2>Новый элемент</h2><p>Slug состоит из строчных латинских букв, цифр и дефисов.</p></div>
          </div>
          <form action={createArticleTaxonomy} className="taxonomy-form">
            <label>Тип<select name="kind"><option value="category">Категория</option><option value="tag">Тег</option></select></label>
            <label>Slug<input name="slug" placeholder="young-scientists" required /></label>
            <label>Название · RU<input name="nameRu" required /></label>
            <label>Название · KK<input name="nameKk" required /></label>
            <button className="primary-button" type="submit"><Plus aria-hidden="true" />Создать</button>
          </form>
        </section>
      ) : null}

      <div className="taxonomy-grid">
        <TaxonomyList icon={FolderTree} title="Категории" items={taxonomy.categories} empty="Категорий пока нет" />
        <TaxonomyList icon={Tags} title="Теги" items={taxonomy.tags} empty="Тегов пока нет" />
      </div>
    </div>
  );
}

function TaxonomyList({ icon: Icon, title, items, empty }: {
  icon: typeof Tags;
  title: string;
  items: Array<{ id: string; slug: string; nameRu: string; nameKk: string; isActive: boolean }>;
  empty: string;
}) {
  return (
    <section className="article-editor-panel taxonomy-list-panel">
      <div className="panel-title"><div><h2><Icon aria-hidden="true" />{title}</h2><p>{items.length} элементов</p></div></div>
      {items.length > 0 ? (
        <ul>{items.map((item) => <li key={item.id}><span><strong>{item.nameRu}</strong><small>{item.nameKk}</small></span><code>{item.slug}</code></li>)}</ul>
      ) : <p className="usage-empty">{empty}</p>}
    </section>
  );
}
