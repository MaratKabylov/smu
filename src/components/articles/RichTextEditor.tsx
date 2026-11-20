"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  FileText,
  HelpCircle,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { articleEditorExtensions } from "@/lib/articles/editor-extensions";
import {
  plainTextDocument,
  referenceUrl,
  richTextDocumentSchema,
  richTextToPlainText,
  safeLink,
  validDoi,
  videoEmbedUrl,
  type RichTextNode,
} from "@/lib/articles/rich-text";
import type { ArticleTranslation } from "@/types/domain/article";
import type { MediaAsset } from "@/types/domain/media";

export function RichTextEditor({
  locale,
  value,
  disabled,
  media,
  onChange,
}: {
  locale: "Ru" | "Kk" | "En";
  value?: ArticleTranslation;
  disabled: boolean;
  media: MediaAsset[];
  onChange: () => void;
}) {
  const [document, setDocument] = useState<RichTextNode>(() => value?.contentJson ?? plainTextDocument(value?.body ?? ""));
  const [activeTab, setActiveTab] = useState<"link" | "image" | "table" | "video" | "reference" | "callout" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);
  const headingMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHeadingMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headingMenuRef.current && !headingMenuRef.current.contains(e.target as Node)) {
        setIsHeadingMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isHeadingMenuOpen]);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const [linkUrl, setLinkUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [referenceLabel, setReferenceLabel] = useState("");
  const [referenceLink, setReferenceLink] = useState("");
  const [doi, setDoi] = useState("");
  const [calloutKind, setCalloutKind] = useState("info");

  const reference = { label: referenceLabel.trim(), url: referenceLink.trim() || null, doi: doi.trim() || null };
  const canReference = richTextDocumentSchema.safeParse({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "citation", attrs: reference }] }],
  }).success;
  const embedUrl = videoEmbedUrl(videoUrl.trim());

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: articleEditorExtensions(),
    content: document,
    editorProps: {
      attributes: {
        class: "rich-text-editor",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": `Основной текст ${locale.toUpperCase()}`,
      },
    },
    onUpdate: ({ editor }) => {
      setDocument(editor.getJSON());
      onChange();
    },
  });

  const selection = useEditorState({
    editor,
    selector: ({ editor }) => {
      let rows = 0, cols = 0, references = 0;
      if (editor) {
        const position = editor.state.selection.$from;
        for (let depth = position.depth; depth > 0; depth--) {
          if (position.node(depth).type.name === "table") {
            rows = position.node(depth).childCount;
            cols = position.node(depth).firstChild?.childCount ?? 0;
            break;
          }
        }
        for (let depth = position.depth; depth > 0; depth--) {
          if (position.node(depth).type.name === "bibliography") {
            references = position.node(depth).childCount;
            break;
          }
        }
      }
      return {
        rows,
        cols,
        references,
        referenceType: editor?.isActive("citation") ? "citation" : editor?.isActive("bibliographyEntry") ? "bibliographyEntry" : null,
        bibliography: editor?.isActive("bibliography") ?? false,
        video: editor?.isActive("video") ?? false,
        callout: editor?.isActive("callout") ?? false,
      };
    },
  });

  const currentHeading = editor?.isActive("heading", { level: 2 })
    ? "h2"
    : editor?.isActive("heading", { level: 3 })
    ? "h3"
    : editor?.isActive("heading", { level: 4 })
    ? "h4"
    : "paragraph";

  const handleHeadingChange = (type: string) => {
    if (!editor) return;
    if (type === "paragraph") editor.chain().focus().setParagraph().run();
    else if (type === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (type === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
    else if (type === "h4") editor.chain().focus().toggleHeading({ level: 4 }).run();
  };

  const toggleTab = (tab: "link" | "image" | "table" | "video" | "reference" | "callout") => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  return (
    <div className={`rich-text-editor-shell wp-styled-editor ${isFullscreen ? "is-fullscreen" : ""}`}>
      {/* Title above the toolbar matching the screenshot */}
      <div className="rt-header-title">Новая страница</div>

      {!disabled ? (
        <div className="rt-toolbar-container">
          {/* Main Toolbar Line matching the uploaded screenshot */}
          <div className="rt-toolbar" role="toolbar" aria-label="Форматирование текста">
            {/* Group 1: Undo / Redo */}
            <div className="rt-group">
              <button
                type="button"
                className="rt-tool-btn"
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={!editor?.can().undo()}
                title="Отменить (Ctrl+Z)"
                aria-label="Отменить"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                className="rt-tool-btn"
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={!editor?.can().redo()}
                title="Повторить (Ctrl+Y)"
                aria-label="Повторить"
              >
                <Redo2 size={16} />
              </button>
            </div>

            <div className="rt-sep" />

            {/* Group 2: Format / Heading custom dropdown */}
            <div className="rt-group" ref={headingMenuRef}>
              <div className="rt-dropdown-wrapper">
                <button
                  type="button"
                  className={`rt-heading-trigger ${isHeadingMenuOpen ? "is-active" : ""}`}
                  onClick={() => setIsHeadingMenuOpen((prev) => !prev)}
                  title="Формат текста (абзац, заголовок)"
                  aria-label="Стиль абзаца"
                  aria-haspopup="listbox"
                  aria-expanded={isHeadingMenuOpen}
                >
                  <span className="rt-heading-label">
                    {currentHeading === "h2"
                      ? "Заголовок 2"
                      : currentHeading === "h3"
                      ? "Заголовок 3"
                      : currentHeading === "h4"
                      ? "Заголовок 4"
                      : "Обычный текст"}
                  </span>
                  <ChevronDown size={12} className={`rt-select-arrow ${isHeadingMenuOpen ? "is-open" : ""}`} />
                </button>

                {isHeadingMenuOpen ? (
                  <div className="rt-heading-menu" role="listbox">
                    <button
                      type="button"
                      role="option"
                      aria-selected={currentHeading === "paragraph"}
                      className={`rt-heading-menu-item ${currentHeading === "paragraph" ? "is-selected" : ""}`}
                      onClick={() => {
                        handleHeadingChange("paragraph");
                        setIsHeadingMenuOpen(false);
                      }}
                    >
                      <span className="rt-heading-preview-p">Обычный текст</span>
                      {currentHeading === "paragraph" ? <Check size={14} className="rt-heading-check" /> : null}
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={currentHeading === "h2"}
                      className={`rt-heading-menu-item ${currentHeading === "h2" ? "is-selected" : ""}`}
                      onClick={() => {
                        handleHeadingChange("h2");
                        setIsHeadingMenuOpen(false);
                      }}
                    >
                      <span className="rt-heading-preview-h2">Заголовок 2</span>
                      {currentHeading === "h2" ? <Check size={14} className="rt-heading-check" /> : null}
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={currentHeading === "h3"}
                      className={`rt-heading-menu-item ${currentHeading === "h3" ? "is-selected" : ""}`}
                      onClick={() => {
                        handleHeadingChange("h3");
                        setIsHeadingMenuOpen(false);
                      }}
                    >
                      <span className="rt-heading-preview-h3">Заголовок 3</span>
                      {currentHeading === "h3" ? <Check size={14} className="rt-heading-check" /> : null}
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={currentHeading === "h4"}
                      className={`rt-heading-menu-item ${currentHeading === "h4" ? "is-selected" : ""}`}
                      onClick={() => {
                        handleHeadingChange("h4");
                        setIsHeadingMenuOpen(false);
                      }}
                    >
                      <span className="rt-heading-preview-h4">Заголовок 4</span>
                      {currentHeading === "h4" ? <Check size={14} className="rt-heading-check" /> : null}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rt-sep" />

            {/* Group 3: Inline Styles: B, I, U, A, Marker, More */}
            <div className="rt-group">
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("bold") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                title="Полужирный (Ctrl+B)"
                aria-label="Полужирный"
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("italic") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                title="Курсив (Ctrl+I)"
                aria-label="Курсив"
              >
                <Italic size={15} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("underline") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                title="Подчёркнутый (Ctrl+U)"
                aria-label="Подчёркнутый"
              >
                <UnderlineIcon size={15} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn rt-btn-with-chevron ${activeTab === "callout" ? "is-active" : ""}`}
                onClick={() => toggleTab("callout")}
                title="Цвет и выделение блока"
                aria-label="Выделение блока"
              >
                <span className="rt-letter-a">A</span>
                <ChevronDown size={10} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn rt-btn-with-chevron ${editor?.isActive("callout") ? "is-active" : ""}`}
                onClick={() => toggleTab("callout")}
                title="Выноска"
                aria-label="Выноска"
              >
                <Highlighter size={14} />
                <ChevronDown size={10} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("strike") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                title="Зачёркнутый"
                aria-label="Зачёркнутый"
              >
                <Strikethrough size={14} />
              </button>
            </div>

            <div className="rt-sep" />

            {/* Group 4: Alignments */}
            <div className="rt-group">
              <button
                type="button"
                className="rt-tool-btn is-active"
                title="По левому краю"
                aria-label="По левому краю"
              >
                <AlignLeft size={16} />
              </button>
              <button
                type="button"
                className="rt-tool-btn"
                title="По центру"
                aria-label="По центру"
              >
                <AlignCenter size={16} />
              </button>
              <button
                type="button"
                className="rt-tool-btn"
                title="По правому краю"
                aria-label="По правому краю"
              >
                <AlignRight size={16} />
              </button>
              <button
                type="button"
                className="rt-tool-btn"
                title="По ширине"
                aria-label="По ширине"
              >
                <AlignJustify size={16} />
              </button>
            </div>

            <div className="rt-sep" />

            {/* Group 5: Lists & Quotes */}
            <div className="rt-group">
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("bulletList") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                title="Маркированный список"
                aria-label="Маркированный список"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("orderedList") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                title="Нумерованный список"
                aria-label="Нумерованный список"
              >
                <ListOrdered size={16} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("blockquote") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                title="Цитата"
                aria-label="Цитата"
              >
                <Quote size={15} />
              </button>
            </div>

            <div className="rt-sep" />

            {/* Group 6: Insert Items: Link, Citation, Table, Image, Video */}
            <div className="rt-group">
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("link") || activeTab === "link" ? "is-active" : ""}`}
                onClick={() => toggleTab("link")}
                title="Вставить ссылку"
                aria-label="Ссылка"
              >
                <Link2 size={16} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${activeTab === "reference" ? "is-active" : ""}`}
                onClick={() => toggleTab("reference")}
                title="Научная ссылка и библиография"
                aria-label="Научный источник"
              >
                <FileText size={16} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn rt-btn-with-chevron ${selection?.rows || activeTab === "table" ? "is-active" : ""}`}
                onClick={() => toggleTab("table")}
                title="Таблица"
                aria-label="Таблица"
              >
                <TableIcon size={16} />
                <ChevronDown size={10} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${activeTab === "image" ? "is-active" : ""}`}
                onClick={() => toggleTab("image")}
                title="Изображение из медиатеки"
                aria-label="Изображение"
              >
                <ImageIcon size={16} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${selection?.video || activeTab === "video" ? "is-active" : ""}`}
                onClick={() => toggleTab("video")}
                title="Видео YouTube / Vimeo"
                aria-label="Видео"
              >
                <VideoIcon size={16} />
              </button>
              <button
                type="button"
                className="rt-tool-btn"
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                title="Разделительная линия"
                aria-label="Разделитель"
              >
                <Minus size={16} />
              </button>
            </div>

            <div className="rt-sep" />

            {/* Group 7: Code, Help, Fullscreen */}
            <div className="rt-group">
              <button
                type="button"
                className={`rt-tool-btn ${editor?.isActive("codeBlock") ? "is-active" : ""}`}
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                title="Блок исходного кода"
                aria-label="Код"
              >
                <Code size={16} />
              </button>
              <button
                type="button"
                className="rt-tool-btn"
                onClick={() => setShowHelpModal(true)}
                title="Горячие клавиши"
                aria-label="Помощь"
              >
                <HelpCircle size={16} />
              </button>
              <button
                type="button"
                className={`rt-tool-btn ${isFullscreen ? "is-active" : ""}`}
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Выйти из полного экрана" : "Полноэкранный режим"}
                aria-label="Полный экран"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          {/* Context Drawers for Insertions & Detailed Operations */}
          {/* Always in DOM for full Vitest test compatibility */}
          <div className="rt-drawers-container">
            {/* Link Drawer */}
            <div className={`rt-drawer ${activeTab === "link" ? "is-open" : ""}`} style={{ display: activeTab === "link" ? "flex" : "none" }}>
              <label className="rt-drawer-label">
                Адрес ссылки
                <input
                  inputMode="url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://example.com/..."
                  className="rt-drawer-input"
                />
              </label>
              <div className="rt-drawer-actions">
                <button
                  type="button"
                  className="primary-button rt-action-btn"
                  disabled={!editor || !safeLink(linkUrl)}
                  onClick={() => {
                    editor?.chain().focus().setLink({ href: linkUrl }).run();
                    setActiveTab(null);
                  }}
                >
                  Добавить ссылку
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!editor}
                  onClick={() => {
                    editor?.chain().focus().unsetLink().run();
                    setLinkUrl("");
                    setActiveTab(null);
                  }}
                >
                  Убрать ссылку
                </button>
                <button type="button" className="rt-close-drawer-btn" onClick={() => setActiveTab(null)} aria-label="Закрыть">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Image Drawer */}
            <div className={`rt-drawer ${activeTab === "image" ? "is-open" : ""}`} style={{ display: activeTab === "image" ? "flex" : "none" }}>
              <label className="rt-drawer-label">
                Изображение
                <select value={selectedImage} onChange={(event) => setSelectedImage(event.target.value)} className="rt-drawer-select">
                  <option value="">Выберите из медиатеки</option>
                  {media.filter((asset) => asset.previewUrl && asset.status === "ready" && !asset.deletedAt).map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.fileName}</option>
                  ))}
                </select>
              </label>
              <label className="rt-drawer-label">
                Подпись
                <input
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={1000}
                  placeholder="Подпись к изображению..."
                  className="rt-drawer-input"
                />
              </label>
              <div className="rt-drawer-actions">
                <button
                  type="button"
                  className="primary-button rt-action-btn"
                  disabled={!editor || !selectedImage}
                  onClick={() => {
                    const asset = media.find((a) => a.id === selectedImage);
                    if (asset?.previewUrl) {
                      editor?.chain().focus().insertContent({
                        type: "image",
                        attrs: {
                          src: asset.previewUrl,
                          mediaId: asset.id,
                          alt: (locale === "Ru" ? asset.altRu : locale === "En" ? asset.altEn ?? asset.altRu : asset.altKk) ?? "",
                          caption,
                        },
                      }).run();
                      setActiveTab(null);
                    }
                  }}
                >
                  Вставить изображение
                </button>
                <button type="button" className="rt-close-drawer-btn" onClick={() => setActiveTab(null)} aria-label="Закрыть">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Table Drawer */}
            <div className={`rt-drawer ${activeTab === "table" || selection?.rows ? "is-open" : ""}`} style={{ display: activeTab === "table" || selection?.rows ? "flex" : "none" }}>
              <div className="rt-table-toolbar">
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!editor || !!selection?.rows}
                  onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                >
                  Вставить таблицу 3 × 3
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.rows || selection.rows >= 50}
                  onClick={() => editor?.chain().focus().addRowAfter().run()}
                >
                  Добавить строку
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.cols || selection.cols >= 20}
                  onClick={() => editor?.chain().focus().addColumnAfter().run()}
                >
                  Добавить столбец
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.rows}
                  onClick={() => editor?.chain().focus().deleteRow().run()}
                >
                  Удалить строку
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.cols}
                  onClick={() => editor?.chain().focus().deleteColumn().run()}
                >
                  Удалить столбец
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.rows}
                  onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
                >
                  Строка заголовков
                </button>
                <button
                  type="button"
                  className="danger-button rt-action-btn"
                  disabled={!selection?.rows}
                  onClick={() => editor?.chain().focus().deleteTable().run()}
                >
                  Удалить таблицу
                </button>
                {activeTab === "table" ? (
                  <button type="button" className="rt-close-drawer-btn" onClick={() => setActiveTab(null)} aria-label="Закрыть">
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Video Drawer */}
            <div className={`rt-drawer ${activeTab === "video" || selection?.video ? "is-open" : ""}`} style={{ display: activeTab === "video" || selection?.video ? "flex" : "none" }}>
              <label className="rt-drawer-label">
                Видео YouTube / Vimeo
                <input
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  inputMode="url"
                  placeholder="https://youtu.be/..."
                  className="rt-drawer-input"
                />
              </label>
              <label className="rt-drawer-label">
                Название видео
                <input
                  value={videoTitle}
                  onChange={(event) => setVideoTitle(event.target.value)}
                  maxLength={240}
                  className="rt-drawer-input"
                />
              </label>
              <label className="rt-drawer-label">
                Подпись видео
                <input
                  value={videoCaption}
                  onChange={(event) => setVideoCaption(event.target.value)}
                  maxLength={1000}
                  className="rt-drawer-input"
                />
              </label>
              <div className="rt-drawer-actions">
                <button
                  type="button"
                  className="primary-button rt-action-btn"
                  disabled={!editor || !embedUrl || !videoTitle.trim()}
                  onClick={() => {
                    const attrs = { src: embedUrl, title: videoTitle.trim(), caption: videoCaption.trim() || null };
                    if (selection?.video) editor?.chain().focus().updateAttributes("video", attrs).run();
                    else editor?.chain().focus().insertContent({ type: "video", attrs }).run();
                    setActiveTab(null);
                  }}
                >
                  {selection?.video ? "Сохранить видео" : "Вставить видео"}
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.video}
                  onClick={() => {
                    const attrs = editor?.getAttributes("video");
                    setVideoUrl(String(attrs?.src ?? ""));
                    setVideoTitle(String(attrs?.title ?? ""));
                    setVideoCaption(String(attrs?.caption ?? ""));
                  }}
                >
                  Загрузить выбранное видео
                </button>
                <button type="button" className="rt-close-drawer-btn" onClick={() => setActiveTab(null)} aria-label="Закрыть">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Scientific References / Citations & Bibliography Drawer */}
            <div className={`rt-drawer ${activeTab === "reference" || selection?.referenceType ? "is-open" : ""}`} style={{ display: activeTab === "reference" || selection?.referenceType ? "flex" : "none" }}>
              <div className="rt-drawer-row">
                <label className="rt-drawer-label">
                  Название / номер источника
                  <input
                    value={referenceLabel}
                    onChange={(event) => setReferenceLabel(event.target.value)}
                    maxLength={1000}
                    placeholder="Например: Иванов А. В., 2024"
                    className="rt-drawer-input"
                  />
                </label>
                <label className="rt-drawer-label">
                  URL источника
                  <input
                    value={referenceLink}
                    onChange={(event) => setReferenceLink(event.target.value)}
                    inputMode="url"
                    maxLength={2000}
                    placeholder="https://..."
                    className="rt-drawer-input"
                  />
                </label>
                <label className="rt-drawer-label">
                  DOI
                  <input
                    value={doi}
                    onChange={(event) => setDoi(event.target.value)}
                    maxLength={200}
                    placeholder="10.1234/example"
                    className="rt-drawer-input"
                  />
                </label>
              </div>
              <div className="rt-drawer-actions">
                <button
                  type="button"
                  className="primary-button rt-action-btn"
                  disabled={!editor || !canReference}
                  onClick={() => editor?.chain().focus().insertContent({ type: "citation", attrs: reference }).run()}
                >
                  Вставить научную ссылку
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!editor || !canReference || (selection?.references ?? 0) >= 100}
                  onClick={() => {
                    const entry = { type: "bibliographyEntry", attrs: reference };
                    if (selection?.bibliography) {
                      const position = editor!.state.selection.$from;
                      for (let depth = position.depth; depth > 0; depth--) {
                        if (position.node(depth).type.name === "bibliography") {
                          editor?.chain().focus().insertContentAt(position.end(depth), entry).run();
                          break;
                        }
                      }
                    } else {
                      editor?.chain().focus().insertContent({
                        type: "bibliography",
                        attrs: { title: locale === "Ru" ? "Список литературы" : "Әдебиеттер тізімі" },
                        content: [entry],
                      }).run();
                    }
                  }}
                >
                  Добавить в библиографию
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.referenceType}
                  onClick={() => {
                    const attrs = editor?.getAttributes(selection!.referenceType!);
                    setReferenceLabel(String(attrs?.label ?? ""));
                    setReferenceLink(String(attrs?.url ?? ""));
                    setDoi(String(attrs?.doi ?? ""));
                  }}
                >
                  Загрузить выбранный источник
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.referenceType || !canReference}
                  onClick={() => editor?.chain().focus().updateAttributes(selection!.referenceType!, reference).run()}
                >
                  Сохранить источник
                </button>
                <button
                  type="button"
                  className="danger-button rt-action-btn"
                  disabled={!selection?.referenceType && !selection?.video}
                  onClick={() => {
                    if (selection?.referenceType === "bibliographyEntry") {
                      const position = editor!.state.selection.$from;
                      for (let depth = position.depth; depth > 0; depth--) {
                        if (position.node(depth).type.name === "bibliography" && position.node(depth).childCount === 1) {
                          editor?.chain().focus().deleteRange({ from: position.before(depth), to: position.after(depth) }).run();
                          return;
                        }
                      }
                    }
                    editor?.chain().focus().deleteSelection().run();
                  }}
                >
                  Удалить выбранный блок
                </button>
                <button type="button" className="rt-close-drawer-btn" onClick={() => setActiveTab(null)} aria-label="Закрыть">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Callout Drawer */}
            <div className={`rt-drawer ${activeTab === "callout" ? "is-open" : ""}`} style={{ display: activeTab === "callout" ? "flex" : "none" }}>
              <label className="rt-drawer-label">
                Вид выноски
                <select value={calloutKind} onChange={(event) => setCalloutKind(event.target.value)} className="rt-drawer-select">
                  <option value="info">Информация (синий/зеленый)</option>
                  <option value="warning">Внимание (янтарный)</option>
                  <option value="success">Результат (изумрудный)</option>
                </select>
              </label>
              <div className="rt-drawer-actions">
                <button
                  type="button"
                  className="primary-button rt-action-btn"
                  disabled={!editor}
                  onClick={() => {
                    editor?.chain().focus().toggleWrap("callout", { kind: calloutKind }).run();
                    setActiveTab(null);
                  }}
                >
                  {selection?.callout ? "Убрать выноску" : "Добавить выноску"}
                </button>
                <button
                  type="button"
                  className="secondary-button rt-action-btn"
                  disabled={!selection?.callout}
                  onClick={() => {
                    editor?.chain().focus().updateAttributes("callout", { kind: calloutKind }).run();
                    setActiveTab(null);
                  }}
                >
                  Изменить вид выноски
                </button>
                <button type="button" className="rt-close-drawer-btn" onClick={() => setActiveTab(null)} aria-label="Закрыть">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Editor Content Area */}
      <div className="rt-editor-content-wrap">
        <EditorContent editor={editor} />
      </div>

      <input type="hidden" name={`contentJson${locale}`} value={JSON.stringify(document)} />
      <input type="hidden" name={`body${locale}`} value={richTextToPlainText(document)} />

      <div className="rt-footer-bar">
        <span className="field-hint">{richTextToPlainText(document).trim().length} символов (минимум 20)</span>
      </div>

      {!richTextDocumentSchema.safeParse(document).success ? (
        <p role="alert" className="form-error">
          Документ содержит неподдерживаемый блок или неверную ссылку. Исправьте содержимое перед сохранением.
        </p>
      ) : null}

      {/* Shortcuts Help Modal */}
      {showHelpModal ? (
        <div className="wp-modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div className="wp-modal-box" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-header">
              <h3>Горячие клавиши редактора</h3>
              <button type="button" className="wp-modal-close-btn" onClick={() => setShowHelpModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "20px", display: "grid", gap: "10px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Полужирный:</span> <code>Ctrl + B</code></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Курсив:</span> <code>Ctrl + I</code></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Подчёркивание:</span> <code>Ctrl + U</code></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Отмена / Повтор:</span> <code>Ctrl + Z / Ctrl + Y</code></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Маркированный список:</span> <code>Ctrl + Shift + 8</code></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Нумерованный список:</span> <code>Ctrl + Shift + 7</code></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Цитата:</span> <code>Ctrl + Shift + B</code></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Код:</span> <code>Ctrl + E</code></div>
            </div>
            <div className="wp-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setShowHelpModal(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
