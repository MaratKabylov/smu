"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import Link from "next/link";
import { RichTextEditor } from "./RichTextEditor";
import { ArticleRelationsEditor } from "./ArticleRelationsEditor";
import type { ArticleRelationLink } from "@/types/domain/article-relations";
import { ArticleAuthorsEditor } from "./ArticleAuthorsEditor";
import { ArticleAutosave, type SaveState } from "@/lib/articles/autosave";
import { saveArticleDraft } from "@/server/actions/article.actions";
import {
  type ArticleAuthorLink,
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
  canPreview?: boolean;
};

export function ArticleForm({
  action,
  article,
  taxonomy,
  media,
  disabled = false,
  submitLabel = "Сохранить статью",
  canPreview = true,
}: ArticleFormProps) {
  const form = useRef<HTMLFormElement>(null);
  const controller = useRef<ArticleAutosave | null>(null);
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });
  const [authors, setAuthors] = useState<ArticleAuthorLink[]>(() => article?.authors.map(item => ({ authorId: item.id, role: item.role })) ?? []);
  const [relations, setRelations] = useState<ArticleRelationLink[]>(() => article?.relations ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(() => article?.categories.map(item => item.id) ?? []);
  const id = article?.id;
  const version = article?.contentVersion;
  const status = article?.status;
  useEffect(() => {
    if (disabled) return;
    let currentId = id ?? null;
    const autosave = new ArticleAutosave(version, () => new FormData(form.current!), async data => {
      const result = await saveArticleDraft(currentId, data);
      if (result.ok) currentId = result.id;
      return result;
    }, (state, result) => {
      setSaveState(state);
      if (result?.ok && state.status === "saved") {
        if (!id) router.replace(`/admin/content/articles/${result.id}?created=1`);
        else router.refresh();
      }
    }, !!id && status === "draft");
    controller.current = autosave;
    const unload = (event: BeforeUnloadEvent) => {
      if (autosave.hasUnsavedChanges) { event.preventDefault(); event.returnValue = ""; }
    };
    const navigation = (event: MouseEvent | SubmitEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (event.type === "click" && (!anchor || anchor.getAttribute("target") === "_blank")) return;
      if (event.type === "submit" && target === form.current) return;
      if (autosave.isSaving || (autosave.hasUnsavedChanges && !window.confirm("Покинуть редактор без сохранения изменений?"))) {
        event.preventDefault(); event.stopPropagation();
        if (autosave.isSaving) window.alert("Дождитесь завершения сохранения перед переходом или изменением статуса.");
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigation, true);
    document.addEventListener("submit", navigation, true);
    return () => {
      autosave.dispose(); controller.current = null;
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigation, true);
      document.removeEventListener("submit", navigation, true);
    };
    // A refreshed server version must not replace edits made during a save.
    // The coordinator advances its version only from the successful response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, disabled, router]);
  const changed = () => controller.current?.changed();
  const ru = article?.translations.find((translation) => translation.locale === "ru");
  const kk = article?.translations.find((translation) => translation.locale === "kk");
  const selectedTags = new Set(article?.tags.map((tag) => tag.id) ?? []);

  return (
    <form ref={form} action={action} className="article-form" onChange={event => {
      const target = event.target;
      if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) && target.name) changed();
    }} onSubmit={event => { event.preventDefault(); void controller.current?.save(); }}>
      {version ? <input type="hidden" name="expectedVersion" value={version} /> : null}
      <input type="hidden" name="creditsVersion" value="1" />
      {categoryIds.map(id => <input type="hidden" name="categoryIds" value={id} key={id} />)}
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
              {taxonomy.contentTypes.filter(type => type.isActive || type.slug === article?.contentType).map((type) => (
                <option value={type.slug} key={type.id}>{type.nameRu} / {type.nameKk}{type.isActive ? "" : " (неактивен)"}</option>
              ))}
            </select>
          </label>
          <label>
            Основная категория
            <select value={categoryIds[0] ?? ""} disabled={disabled || !categoryIds.length} onChange={event => {
              setCategoryIds([event.target.value, ...categoryIds.filter(id => id !== event.target.value)]); changed();
            }}>
              {!categoryIds.length ? <option value="">Без категории</option> : null}
              {taxonomy.categories.filter(item => categoryIds.includes(item.id)).map((category) => (
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
          <legend>Категории · до 20</legend>
          <div className="tag-options">
            {taxonomy.categories.filter(item => item.isActive || categoryIds.includes(item.id)).map(category => <label key={category.id}>
              <input type="checkbox" checked={categoryIds.includes(category.id)} disabled={!categoryIds.includes(category.id) && categoryIds.length >= 20} onChange={event => {
                setCategoryIds(event.target.checked ? [...categoryIds, category.id] : categoryIds.filter(id => id !== category.id)); changed();
              }} />
              <span>{category.nameRu}{category.isActive ? "" : " (неактивна)"}</span>
            </label>)}
          </div>
        </fieldset>
        <ArticleAuthorsEditor authors={taxonomy.authors} value={authors} disabled={disabled} onChange={value => { setAuthors(value); changed(); }} />
        <p className="field-hint"><Link href="/admin/content/articles/taxonomy">Авторы и справочники журнала</Link></p>

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
              <Link href="/admin/content/articles/taxonomy">«Авторы и справочники»</Link>.
            </p>
          )}
        </fieldset>
      </section>

      <ArticleRelationsEditor value={relations} disabled={disabled} onChange={value => { setRelations(value); changed(); }} />
      <div className="translation-grid">
        <TranslationFields locale="Ru" language="Русская версия" value={ru} disabled={disabled} media={media} onChange={changed} />
        <TranslationFields locale="Kk" language="Қазақша нұсқа" value={kk} disabled={disabled} media={media} onChange={changed} />
      </div>

      {!disabled ? (
        <div className="article-form-actions">
          <button className="primary-button" type="submit" disabled={saveState.status === "saving" || saveState.error === "stale_version"}>
            <Save aria-hidden="true" />
            {submitLabel}
          </button>
          <span role="status" aria-live="polite">{saveState.status === "saving" ? "Сохранение…" : saveState.status === "dirty" ? "Есть несохранённые изменения" : saveState.status === "saved" ? (article ? "Сохранено" : "Черновик ещё не создан") : saveErrorMessages[saveState.error ?? ""] ?? "Не удалось сохранить. Правки остаются в редакторе; попробуйте снова."}</span>
          {saveState.error === "stale_version" && id ? <a className="secondary-button" href={`/admin/content/articles/${id}`} target="_blank" rel="noopener noreferrer">Открыть актуальную версию</a> : null}
        </div>
      ) : null}
      {article && canPreview ? <div className="preview-links">
        {(["ru", "kk"] as const).map(locale => <a className="secondary-button" key={locale} href={`/admin/content/articles/${article.id}/preview/${locale}`} target="_blank" rel="noopener noreferrer">Предпросмотр {locale.toUpperCase()}</a>)}
        <small>Предпросмотр показывает последнюю сохранённую версию.</small>
      </div> : null}
    </form>
  );
}

type TranslationFieldsProps = {
  locale: "Ru" | "Kk";
  language: string;
  value?: Article["translations"][number];
  disabled: boolean;
  media: MediaAsset[];
  onChange: () => void;
};

function TranslationFields({ locale, language, value, disabled, media, onChange }: TranslationFieldsProps) {
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
        <RichTextEditor locale={locale} value={value} disabled={disabled} media={media} onChange={onChange} />
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

const saveErrorMessages: Record<string, string> = {
  validation: "Заполните обе версии: заголовок, slug, описание и основной текст (минимум 20 символов). Правки остаются в редакторе.",
  stale_version: "Статья изменена в другой вкладке. Ваши правки остаются здесь; откройте актуальную версию отдельно и перенесите изменения.",
  forbidden: "Недостаточно прав для сохранения. Правки остаются в редакторе.",
  slug_conflict: "Этот slug уже занят. Измените адрес и сохраните снова.",
  slug_reserved: "Этот адрес сохранён в истории другого материала. Выберите другой slug.",
  invalid_reference: "Выбранные связи, авторы, тип, категории или файлы недоступны. Обновите выбор и сохраните снова.",
};
