import { saveArticleAuthor, updateArticleTaxonomy } from "@/server/actions/article.actions";
import type { ArticleAuthor, ArticleTaxonomyItem } from "@/types/domain/article";
import { SubmitButton } from "@/components/science/SubmitButton";

export function ArticleTaxonomyDirectory({ title, kind, items, mayManage }: {
  title: string; kind: "category" | "tag" | "type"; items: ArticleTaxonomyItem[]; mayManage: boolean;
}) {
  return <section className="article-editor-panel taxonomy-list-panel">
    <h2>{title} · {items.length}</h2>
    {items.map(item => <details key={item.id}>
      <summary>{item.nameRu} / {item.nameKk} · {item.isActive ? "Активен" : "Неактивен"}</summary>
      {mayManage ? <form action={updateArticleTaxonomy} className="translation-fields">
        <input type="hidden" name="id" value={item.id} /><input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="slug" value={item.slug} />
        <p>Постоянный код: <code>{item.slug}</code></p>
        <label>Название · RU<input name="nameRu" defaultValue={item.nameRu} minLength={2} maxLength={120} required /></label>
        <label>Название · KK<input name="nameKk" defaultValue={item.nameKk} minLength={2} maxLength={120} required /></label>
        <label>Название · EN (необязательно)<input name="nameEn" defaultValue={item.nameEn ?? ""} minLength={2} maxLength={120} /></label>
        <label className="confirm-check"><input type="checkbox" name="isActive" value="yes" defaultChecked={item.isActive} />Доступен для новых материалов</label>
        <SubmitButton label="Сохранить" />
      </form> : <p><code>{item.slug}</code></p>}
    </details>)}
    {!items.length ? <p>Пока нет элементов.</p> : null}
  </section>;
}

export function ArticleAuthorDirectoryForm({ author, profiles }: {
  author?: ArticleAuthor; profiles: Array<{ id: string; display_name: string | null }>;
}) {
  return <form action={saveArticleAuthor} className="translation-fields">
    {author ? <input type="hidden" name="id" value={author.id} /> : null}
    <div className="form-three-columns">
      <label>Имя · RU<input name="nameRu" defaultValue={author?.nameRu ?? ""} minLength={2} maxLength={160} required /></label>
      <label>Имя · KK<input name="nameKk" defaultValue={author?.nameKk ?? ""} minLength={2} maxLength={160} required /></label>
      <label>Имя · EN (необязательно)<input name="nameEn" defaultValue={author?.nameEn ?? ""} minLength={2} maxLength={160} /></label>
      <label>Учётная запись<select name="profileId" defaultValue={author?.profileId ?? ""}>
        <option value="">Внешний автор · без учётной записи</option>
        {profiles.map(profile => <option value={profile.id} key={profile.id}>{profile.display_name ?? "Пользователь"} · {profile.id.slice(0, 8)}</option>)}
      </select></label>
    </div>
    <div className="translation-grid">
      <label>Об авторе · RU<textarea name="bioRu" defaultValue={author?.bioRu ?? ""} maxLength={2000} rows={3} /></label>
      <label>Об авторе · KK<textarea name="bioKk" defaultValue={author?.bioKk ?? ""} maxLength={2000} rows={3} /></label>
      <label>Об авторе · EN<textarea name="bioEn" defaultValue={author?.bioEn ?? ""} maxLength={2000} rows={3} /></label>
    </div>
    <div className="form-three-columns">
      <label>Организация<input name="organization" defaultValue={author?.organization ?? ""} maxLength={240} /></label>
      <label>Должность<input name="position" defaultValue={author?.position ?? ""} maxLength={240} /></label>
      <label>Сайт автора<input type="url" name="websiteUrl" defaultValue={author?.websiteUrl ?? ""} maxLength={500} placeholder="https://example.kz" /></label>
    </div>
    <label className="confirm-check"><input type="checkbox" name="isActive" value="yes" defaultChecked={author?.isActive ?? true} />Доступен для новых материалов</label>
    <SubmitButton label={author ? "Сохранить автора" : "Создать автора"} />
  </form>;
}
