import { Save } from "lucide-react";
import Link from "next/link";
import { articleContentTypeLabels } from "@/lib/articles/presentation";
import {
  articleContentTypes,
  type Article,
  type ArticleTaxonomy,
} from "@/types/domain/article";
import type { MediaAsset } from "@/types/domain/media";

type ArticleFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  article?: Article;
  taxonomy: ArticleTaxonomy;
  media: MediaAsset[];
  disabled?: boolean;
  submitLabel?: string;
};

export function ArticleForm({
  action,
  article,
  taxonomy,
  media,
  disabled = false,
  submitLabel = "Сохранить статью",
}: ArticleFormProps) {
  const ru = article?.translations.find((translation) => translation.locale === "ru");
  const kk = article?.translations.find((translation) => translation.locale === "kk");
  const selectedTags = new Set(article?.tags.map((tag) => tag.id) ?? []);

  return (
    <form action={action} className="article-form">
      <section className="article-editor-panel">
        <div className="panel-title">
          <div>
            <h2>Параметры материала</h2>
            <p>Тип, рубрика, обложка и тематические метки.</p>
          </div>
        </div>
        <div className="form-three-columns">
          <label>
            Тип материала
            <select name="contentType" defaultValue={article?.contentType ?? "article"} disabled={disabled}>
              {articleContentTypes.map((type) => (
                <option value={type} key={type}>{articleContentTypeLabels[type]}</option>
              ))}
            </select>
          </label>
          <label>
            Категория
            <select name="categoryId" defaultValue={article?.categoryId ?? ""} disabled={disabled}>
              <option value="">Без категории</option>
              {taxonomy.categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.nameRu} / {category.nameKk}
                </option>
              ))}
            </select>
          </label>
          <label>
            Обложка из медиатеки
            <select name="coverMediaId" defaultValue={article?.coverMediaId ?? ""} disabled={disabled}>
              <option value="">Без обложки</option>
              {media.map((asset) => (
                <option value={asset.id} key={asset.id}>{asset.fileName}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="tag-fieldset" disabled={disabled}>
          <legend>Теги</legend>
          {taxonomy.tags.length > 0 ? (
            <div className="tag-options">
              {taxonomy.tags.map((tag) => (
                <label key={tag.id}>
                  <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={selectedTags.has(tag.id)} />
                  <span>{tag.nameRu}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="field-hint">
              Тегов пока нет. Создайте их в разделе{" "}
              <Link href="/admin/content/articles/taxonomy">«Категории и теги»</Link>.
            </p>
          )}
        </fieldset>
      </section>

      <div className="translation-grid">
        <TranslationFields locale="Ru" language="Русская версия" value={ru} disabled={disabled} />
        <TranslationFields locale="Kk" language="Қазақша нұсқа" value={kk} disabled={disabled} />
      </div>

      {!disabled ? (
        <div className="article-form-actions">
          <button className="primary-button" type="submit">
            <Save aria-hidden="true" />
            {submitLabel}
          </button>
        </div>
      ) : null}
    </form>
  );
}

type TranslationFieldsProps = {
  locale: "Ru" | "Kk";
  language: string;
  value?: Article["translations"][number];
  disabled: boolean;
};

function TranslationFields({ locale, language, value, disabled }: TranslationFieldsProps) {
  return (
    <section className="article-editor-panel translation-panel">
      <div className="panel-title">
        <div>
          <h2>{language}</h2>
          <p>Публикация требует заполнения обеих языковых версий.</p>
        </div>
        <span className="locale-badge">{locale.toUpperCase()}</span>
      </div>
      <div className="translation-fields">
        <label>
          Заголовок
          <input name={`title${locale}`} defaultValue={value?.title ?? ""} minLength={3} maxLength={240} required disabled={disabled} />
        </label>
        <label>
          URL slug
          <input name={`slug${locale}`} defaultValue={value?.slug ?? ""} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="science-in-region" required disabled={disabled} />
        </label>
        <label>
          Краткое описание
          <textarea name={`excerpt${locale}`} defaultValue={value?.excerpt ?? ""} minLength={10} maxLength={1000} rows={4} required disabled={disabled} />
        </label>
        <label>
          Основной текст
          <textarea className="article-body-field" name={`body${locale}`} defaultValue={value?.body ?? ""} minLength={20} rows={18} required disabled={disabled} />
        </label>
        <label>
          SEO title
          <input name={`seoTitle${locale}`} defaultValue={value?.seoTitle ?? ""} maxLength={70} disabled={disabled} />
        </label>
        <label>
          SEO description
          <textarea name={`seoDescription${locale}`} defaultValue={value?.seoDescription ?? ""} maxLength={170} rows={3} disabled={disabled} />
        </label>
      </div>
    </section>
  );
}
