"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Check, Eye, Image as ImageIcon, RotateCcw, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { ArticleRelationsEditor } from "./ArticleRelationsEditor";
import type { ArticleRelationLink } from "@/types/domain/article-relations";
import { ArticleAuthorsEditor } from "./ArticleAuthorsEditor";
import { CustomSelect } from "./CustomSelect";
import { generateSlug } from "@/lib/articles/slug";
import { plainTextDocument, richTextToPlainText } from "@/lib/articles/rich-text-plain";
import { ArticleAutosave, type SaveState } from "@/lib/articles/autosave";
import { saveArticleDraft } from "@/server/actions/article.actions";
import {
  type ArticleAuthorLink,
  type Article,
  type ArticleTaxonomy,
} from "@/types/domain/article";
import type { MediaAsset } from "@/types/domain/media";

const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rich-text-editor-shell wp-styled-editor" aria-busy="true">
        <div className="rt-editor-content-wrap" style={{ minHeight: "360px", padding: "20px", color: "#64748b" }}>
          Загрузка редактора…
        </div>
      </div>
    ),
  },
);

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
  const searchInputId = useId();
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });
  const [authors, setAuthors] = useState<ArticleAuthorLink[]>(() => article?.authors.map(item => ({ authorId: item.id, role: item.role })) ?? []);
  const [relations, setRelations] = useState<ArticleRelationLink[]>(() => article?.relations ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(() => article?.categories.map(item => item.id) ?? []);
  const [activeLocale, setActiveLocale] = useState<"Ru" | "Kk" | "En">("Ru");
  const [mountedLocales, setMountedLocales] = useState<Set<"Ru" | "Kk" | "En">>(() => new Set(["Ru"]));
  const [coverMediaId, setCoverMediaId] = useState<string>(() => article?.coverMediaId ?? "");
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");

  const selectLocale = (locale: "Ru" | "Kk" | "En") => {
    setActiveLocale(locale);
    setMountedLocales((prev) => (prev.has(locale) ? prev : new Set([...prev, locale])));
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, disabled, router]);

  const changed = () => controller.current?.changed();
  const ru = article?.translations.find((translation) => translation.locale === "ru");
  const kk = article?.translations.find((translation) => translation.locale === "kk");
  const en = article?.translations.find((translation) => translation.locale === "en");
  const selectedTags = new Set(article?.tags.map((tag) => tag.id) ?? []);

  const selectedCover = media.find(m => m.id === coverMediaId);
  const filteredMedia = media.filter(asset =>
    asset.previewUrl &&
    asset.status === "ready" &&
    !asset.deletedAt &&
    (!mediaSearchQuery.trim() ||
      asset.fileName.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
      (asset.altRu && asset.altRu.toLowerCase().includes(mediaSearchQuery.toLowerCase())))
  );

  const handleSelectCover = (assetId: string) => {
    setCoverMediaId(assetId);
    setIsMediaModalOpen(false);
    changed();
  };

  const handleRemoveCover = () => {
    setCoverMediaId("");
    changed();
  };

  return (
    <form ref={form} action={action} className="article-form wp-editor-form" onChange={event => {
      const target = event.target;
      if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) && target.name) changed();
    }} onSubmit={event => { event.preventDefault(); void controller.current?.save(); }}>
      {version ? <input type="hidden" name="expectedVersion" value={version} /> : null}
      <input type="hidden" name="creditsVersion" value="1" />
      {categoryIds.map(catId => <input type="hidden" name="categoryIds" value={catId} key={catId} />)}

      {/* Synchronized hidden select for coverMediaId to guarantee exact form-data serialization */}
      <select name="coverMediaId" value={coverMediaId} onChange={e => { setCoverMediaId(e.target.value); changed(); }} style={{ display: "none" }}>
        <option value="">Без обложки</option>
        {media.map((asset) => (
          <option value={asset.id} key={asset.id}>{asset.fileName}</option>
        ))}
      </select>

      {/* TOPBAR: Language Tabs, Autosave indicator & Primary Action */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии статьи">
            <button
              type="button"
              role="tab"
              aria-selected={activeLocale === "Ru"}
              className={`wp-lang-tab ${activeLocale === "Ru" ? "is-active" : ""}`}
              onClick={() => selectLocale("Ru")}
            >
              <span className={`wp-tab-dot ${ru?.title ? "is-filled" : ""}`} />
              Русский
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLocale === "Kk"}
              className={`wp-lang-tab ${activeLocale === "Kk" ? "is-active" : ""}`}
              onClick={() => selectLocale("Kk")}
            >
              <span className={`wp-tab-dot ${kk?.title ? "is-filled" : ""}`} />
              Қазақша
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLocale === "En"}
              className={`wp-lang-tab ${activeLocale === "En" ? "is-active" : ""}`}
              onClick={() => selectLocale("En")}
            >
              <span className={`wp-tab-dot ${en?.title ? "is-filled" : ""}`} />
              English <small className="wp-tab-optional">необяз.</small>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          <div className="wp-save-indicator" role="status" aria-live="polite">
            {saveState.status === "saving" && <span className="wp-indicator is-saving">Сохранение…</span>}
            {saveState.status === "dirty" && <span className="wp-indicator is-dirty">Есть несохранённые правки</span>}
            {saveState.status === "saved" && (
              <span className="wp-indicator is-saved">
                <Check aria-hidden="true" /> {article ? "Сохранено" : "Черновик готов"}
              </span>
            )}
            {saveState.status === "error" && (
              <span className="wp-indicator is-error" title={saveErrorMessages[saveState.error ?? ""]}>
                {saveErrorMessages[saveState.error ?? ""] ?? "Ошибка сохранения"}
              </span>
            )}
          </div>

          {article && canPreview ? (
            <div className="wp-preview-group">
              <a
                className="secondary-button wp-preview-link"
                href={`/admin/content/articles/${article.id}/preview/${activeLocale.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye aria-hidden="true" /> Предпросмотр ({activeLocale.toUpperCase()})
              </a>
            </div>
          ) : null}

          {!disabled ? (
            <button
              className="primary-button wp-submit-btn"
              type="submit"
              disabled={saveState.status === "saving" || saveState.error === "stale_version"}
            >
              <Save aria-hidden="true" />
              {submitLabel}
            </button>
          ) : null}
        </div>
      </div>

      {saveState.error === "stale_version" && id ? (
        <div className="notice error-notice" style={{ marginBottom: "16px" }}>
          Материал был изменён в другой вкладке. Ваши правки сохранены здесь.{" "}
          <a className="secondary-button" href={`/admin/content/articles/${id}`} target="_blank" rel="noopener noreferrer">
            Открыть актуальную версию
          </a>
        </div>
      ) : null}

      {/* MAIN 2-COLUMN LAYOUT: Content Editor on Left, Inspector Sidebar on Right */}
      <div className="wp-editor-workspace">
        {/* LEFT COLUMN: Active Language Title, Excerpt, Content & SEO */}
        <div className="wp-editor-main">
          <TranslationWorkspace
            locale="Ru"
            languageLabel="Русская версия"
            value={ru}
            active={activeLocale === "Ru"}
            editorMounted={mountedLocales.has("Ru")}
            disabled={disabled}
            media={media}
            onChange={changed}
          />
          <TranslationWorkspace
            locale="Kk"
            languageLabel="Қазақша нұсқа"
            value={kk}
            active={activeLocale === "Kk"}
            editorMounted={mountedLocales.has("Kk")}
            disabled={disabled}
            media={media}
            onChange={changed}
          />
          <TranslationWorkspace
            locale="En"
            languageLabel="English version (optional)"
            value={en}
            active={activeLocale === "En"}
            editorMounted={mountedLocales.has("En")}
            disabled={disabled}
            media={media}
            onChange={changed}
            optional
          />

          {/* Collapsible Related Scientific Objects Box */}
          <details className="wp-metabox-card" open>
            <summary className="wp-metabox-header">Связанные научные объекты и авторы</summary>
            <div className="wp-metabox-content">
              <ArticleRelationsEditor value={relations} disabled={disabled} onChange={value => { setRelations(value); changed(); }} />
            </div>
          </details>
        </div>

        {/* RIGHT SIDEBAR: WordPress-style inspector */}
        <aside className="wp-editor-sidebar">
          {/* Card: Status & Publication */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Параметры материала</summary>
            <div className="wp-sidebar-card-body">
              <div className="wp-field-group">
                <span className="wp-field-label">Тип материала</span>
                <CustomSelect
                  name="contentType"
                  defaultValue={article?.contentType ?? "article"}
                  disabled={disabled}
                  options={taxonomy.contentTypes
                    .filter((type) => type.isActive || type.slug === article?.contentType)
                    .map((type) => ({
                      value: type.slug,
                      label: `${type.nameRu} / ${type.nameKk}${type.isActive ? "" : " (неактивен)"}`,
                    }))}
                  onChange={changed}
                />
              </div>
              {article ? (
                <div className="wp-sidebar-meta-row">
                  <span>Статус:</span>
                  <strong>{article.status}</strong>
                </div>
              ) : null}
            </div>
          </details>

          {/* Card: Featured Image / Cover Image with Visual Preview */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Изображение записи (обложка)</summary>
            <div className="wp-sidebar-card-body">
              {selectedCover ? (
                <div className="wp-cover-preview-card">
                  <div className="wp-cover-thumbnail-box">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedCover.previewUrl ?? ""}
                      alt={selectedCover.altRu ?? selectedCover.fileName}
                      className="wp-cover-image"
                    />
                  </div>
                  <div className="wp-cover-info">
                    <p className="wp-cover-filename" title={selectedCover.fileName}>{selectedCover.fileName}</p>
                    {selectedCover.width && selectedCover.height ? (
                      <small className="wp-cover-dimensions">{selectedCover.width} × {selectedCover.height} px</small>
                    ) : null}
                  </div>
                  <div className="wp-cover-actions">
                    <button
                      type="button"
                      className="secondary-button wp-cover-btn"
                      onClick={() => setIsMediaModalOpen(true)}
                      disabled={disabled}
                    >
                      Заменить обложку
                    </button>
                    <button
                      type="button"
                      className="danger-button wp-cover-btn wp-cover-remove"
                      onClick={handleRemoveCover}
                      disabled={disabled}
                      title="Удалить обложку"
                    >
                      <Trash2 aria-hidden="true" /> Удалить
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="wp-cover-empty-dropzone"
                  onClick={() => setIsMediaModalOpen(true)}
                  disabled={disabled}
                >
                  <ImageIcon className="wp-cover-icon" aria-hidden="true" />
                  <span>Выбрать обложку из медиатеки</span>
                  <small>Рекомендуемый размер 1200 × 630 px</small>
                </button>
              )}
            </div>
          </details>

          {/* Card: Categories */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">
              Рубрики и категории ({categoryIds.length})
            </summary>
            <div className="wp-sidebar-card-body">
              <div className="wp-field-group">
                <span className="wp-field-label">Основная категория</span>
                <CustomSelect
                  value={categoryIds[0] ?? ""}
                  disabled={disabled || !categoryIds.length}
                  options={[
                    ...(!categoryIds.length ? [{ value: "", label: "Без категории" }] : []),
                    ...taxonomy.categories
                      .filter((item) => categoryIds.includes(item.id))
                      .map((category) => ({
                        value: category.id,
                        label: `${category.nameRu} / ${category.nameKk}`,
                      })),
                  ]}
                  onChange={(val) => {
                    if (val) {
                      setCategoryIds([val, ...categoryIds.filter((catId) => catId !== val)]);
                    }
                    changed();
                  }}
                />
              </div>

              <fieldset className="tag-fieldset" disabled={disabled} style={{ margin: "8px 0 0" }}>
                <legend style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Все категории (до 20)</legend>
                <div className="wp-category-checklist">
                  {taxonomy.categories.filter(item => item.isActive || categoryIds.includes(item.id)).map(category => (
                    <label key={category.id} className="wp-checklist-item">
                      <input
                        type="checkbox"
                        checked={categoryIds.includes(category.id)}
                        disabled={!categoryIds.includes(category.id) && categoryIds.length >= 20}
                        onChange={event => {
                          setCategoryIds(event.target.checked ? [...categoryIds, category.id] : categoryIds.filter(catId => catId !== category.id));
                          changed();
                        }}
                      />
                      <span>{category.nameRu}{category.isActive ? "" : " (неактивна)"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>

          {/* Card: Authors */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Авторы материала ({authors.length})</summary>
            <div className="wp-sidebar-card-body">
              <ArticleAuthorsEditor
                authors={taxonomy.authors}
                value={authors}
                disabled={disabled}
                onChange={value => { setAuthors(value); changed(); }}
              />
              <p className="field-hint" style={{ marginTop: "6px" }}>
                <Link href="/admin/content/articles/taxonomy" target="_blank">Справочник авторов ↗</Link>
              </p>
            </div>
          </details>

          {/* Card: Tags */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Теги</summary>
            <div className="wp-sidebar-card-body">
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
                  Тегов пока нет. Создайте их в{" "}
                  <Link href="/admin/content/articles/taxonomy" target="_blank">«Авторы и справочники» ↗</Link>.
                </p>
              )}
            </div>
          </details>
        </aside>
      </div>

      {/* MEDIA PICKER MODAL */}
      {isMediaModalOpen ? (
        <div className="wp-modal-backdrop" onClick={() => setIsMediaModalOpen(false)}>
          <div className="wp-modal-box" onClick={e => e.stopPropagation()}>
            <div className="wp-modal-header">
              <h3>Выбор обложки из медиатеки</h3>
              <button
                type="button"
                className="wp-modal-close-btn"
                onClick={() => setIsMediaModalOpen(false)}
                aria-label="Закрыть"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="wp-modal-toolbar">
              <label htmlFor={searchInputId} className="visually-hidden">Поиск по названию файла</label>
              <input
                id={searchInputId}
                type="search"
                value={mediaSearchQuery}
                onChange={e => setMediaSearchQuery(e.target.value)}
                placeholder="Поиск по названию файла или описанию..."
                className="wp-modal-search-input"
              />
              <Link href="/admin/content/media" target="_blank" className="secondary-button wp-modal-upload-link">
                Медиатека ↗
              </Link>
            </div>

            <div className="wp-modal-grid">
              {filteredMedia.length > 0 ? (
                filteredMedia.map(asset => (
                  <div
                    key={asset.id}
                    className={`wp-modal-item ${asset.id === coverMediaId ? "is-selected" : ""}`}
                    onClick={() => handleSelectCover(asset.id)}
                  >
                    <div className="wp-modal-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.previewUrl ?? ""} alt={asset.fileName} loading="lazy" />
                    </div>
                    <span className="wp-modal-filename" title={asset.fileName}>{asset.fileName}</span>
                    {asset.id === coverMediaId ? <span className="wp-modal-tag">Выбрано</span> : null}
                  </div>
                ))
              ) : (
                <div className="wp-modal-empty">
                  {media.length === 0 ? "В медиатеке пока нет готовых изображений." : "Изображения по запросу не найдены."}
                </div>
              )}
            </div>

            <div className="wp-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setIsMediaModalOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

type TranslationWorkspaceProps = {
  locale: "Ru" | "Kk" | "En";
  languageLabel: string;
  value?: Article["translations"][number];
  active: boolean;
  editorMounted: boolean;
  disabled: boolean;
  media: MediaAsset[];
  onChange: () => void;
  optional?: boolean;
};

function TranslationWorkspace({
  locale,
  value,
  active,
  editorMounted,
  disabled,
  media,
  onChange,
  optional = false,
}: TranslationWorkspaceProps) {
  const [title, setTitle] = useState(value?.title ?? "");
  const [slug, setSlug] = useState(value?.slug ?? "");
  const [isSlugTouched, setIsSlugTouched] = useState(Boolean(value?.slug));
  const [excerpt, setExcerpt] = useState(value?.excerpt ?? "");
  const [seoTitle, setSeoTitle] = useState(value?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(value?.seoDescription ?? "");
  const initialDocument = useMemo(
    () => value?.contentJson ?? plainTextDocument(value?.body ?? ""),
    [value?.body, value?.contentJson],
  );
  const initialContentJson = useMemo(() => JSON.stringify(initialDocument), [initialDocument]);
  const initialPlainBody = useMemo(() => richTextToPlainText(initialDocument), [initialDocument]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isSlugTouched) {
      setSlug(generateSlug(newTitle));
    }
    onChange();
  };

  const handleSlugChange = (newSlug: string) => {
    setSlug(newSlug);
    setIsSlugTouched(true);
    onChange();
  };

  const handleRegenerateSlug = () => {
    const autoSlug = generateSlug(title);
    setSlug(autoSlug);
    setIsSlugTouched(false);
    onChange();
  };

  return (
    <div className={`wp-locale-pane ${active ? "is-active" : ""}`} style={{ display: active ? "flex" : "none" }}>
      {/* Title Field (WordPress-like large H1 input) */}
      <div className="wp-title-section">
        <label className="visually-hidden" htmlFor={`title-field-${locale}`}>Заголовок ({locale})</label>
        <input
          id={`title-field-${locale}`}
          name={`title${locale}`}
          defaultValue={value?.title ?? ""}
          minLength={3}
          maxLength={240}
          required={!optional}
          disabled={disabled}
          className="wp-title-input"
          placeholder={locale === "Ru" ? "Добавьте заголовок материала..." : locale === "Kk" ? "Материал тақырыбын енгізіңіз..." : "Add article title..."}
          onChange={e => handleTitleChange(e.target.value)}
        />
      </div>

      {/* Permalink / Slug bar */}
      <div className="wp-permalink-bar">
        <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/articles/</span>
        <input
          name={`slug${locale}`}
          value={slug}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="latin-slug-url"
          required={!optional}
          disabled={disabled}
          className="wp-permalink-input"
          onChange={e => handleSlugChange(e.target.value)}
        />
        {title.trim() ? (
          <button
            type="button"
            className="wp-permalink-refresh-btn"
            onClick={handleRegenerateSlug}
            title="Сгенерировать ссылку из заголовка"
            aria-label="Сгенерировать ссылку из заголовка"
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Обновить</span>
          </button>
        ) : null}
      </div>

      {/* Excerpt / Lead */}
      <div className="wp-excerpt-section">
        <label>
          <span className="wp-field-label">Краткое описание (лид статьи)</span>
          <textarea
            name={`excerpt${locale}`}
            defaultValue={value?.excerpt ?? ""}
            minLength={10}
            maxLength={1000}
            rows={3}
            required={!optional}
            disabled={disabled}
            className="wp-excerpt-textarea"
            placeholder="Вводный абзац статьи для карточек и анонсов на главной странице..."
            onChange={e => { setExcerpt(e.target.value); onChange(); }}
          />
        </label>
      </div>

      {/* Rich Text Editor */}
      <div className="wp-editor-content-box">
        {editorMounted ? (
          <RichTextEditor locale={locale} value={value} disabled={disabled} media={media} onChange={onChange} />
        ) : (
          <>
            <input type="hidden" name={`contentJson${locale}`} value={initialContentJson} />
            <input type="hidden" name={`body${locale}`} value={initialPlainBody} />
          </>
        )}
      </div>

      {/* Collapsible SEO Box */}
      <details className="wp-metabox-card wp-seo-card" open>
        <summary className="wp-metabox-header">
          Поисковая оптимизация (SEO · {locale.toUpperCase()})
        </summary>
        <div className="wp-metabox-content">
          <div className="wp-seo-preview">
            <span className="wp-seo-preview-label">Предпросмотр в поисковой выдаче Google</span>
            <div className="wp-seo-preview-snippet">
              <span className="wp-seo-preview-url">https://smu.kz › articles › {slug || "primer-slug"}</span>
              <h4 className="wp-seo-preview-title">{seoTitle || title || "Заголовок статьи в поиске"}</h4>
              <p className="wp-seo-preview-desc">
                {seoDescription || excerpt || "Краткое описание статьи будет отображаться в поисковой выдаче для привлечения читателей."}
              </p>
            </div>
          </div>

          <div className="wp-seo-fields">
            <label>
              <div className="wp-seo-field-label">
                <span>SEO Title</span>
                <small className="wp-char-counter">{seoTitle.length} / 70</small>
              </div>
              <input
                name={`seoTitle${locale}`}
                defaultValue={value?.seoTitle ?? ""}
                maxLength={70}
                disabled={disabled}
                className="wp-seo-input"
                placeholder="Заголовок для поисковиков (если отличается от основного)"
                onChange={e => { setSeoTitle(e.target.value); onChange(); }}
              />
            </label>
            <label>
              <div className="wp-seo-field-label">
                <span>SEO Description</span>
                <small className="wp-char-counter">{seoDescription.length} / 170</small>
              </div>
              <textarea
                name={`seoDescription${locale}`}
                defaultValue={value?.seoDescription ?? ""}
                maxLength={170}
                rows={3}
                disabled={disabled}
                className="wp-seo-textarea"
                placeholder="Краткое описание для поисковой выдачи"
                onChange={e => { setSeoDescription(e.target.value); onChange(); }}
              />
            </label>
          </div>
        </div>
      </details>
    </div>
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
