"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { articleEditorExtensions } from "@/lib/articles/editor-extensions";
import { plainTextDocument, referenceUrl, richTextDocumentSchema, richTextToPlainText, safeLink, validDoi, videoEmbedUrl, type RichTextNode } from "@/lib/articles/rich-text";
import type { ArticleTranslation } from "@/types/domain/article";
import type { MediaAsset } from "@/types/domain/media";

export function RichTextEditor({ locale, value, disabled, media, onChange }: {
  locale: "Ru" | "Kk" | "En"; value?: ArticleTranslation; disabled: boolean;
  media: MediaAsset[]; onChange: () => void;
}) {
  const [document, setDocument] = useState<RichTextNode>(() => value?.contentJson ?? plainTextDocument(value?.body ?? ""));
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
  const canReference = richTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "citation", attrs: reference }] }] }).success;
  const embedUrl = videoEmbedUrl(videoUrl.trim());
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: articleEditorExtensions(),
    content: document,
    editorProps: { attributes: { class: "rich-text-editor", role: "textbox", "aria-multiline": "true", "aria-label": `Основной текст ${locale.toUpperCase()}` } },
    onUpdate: ({ editor }) => { setDocument(editor.getJSON()); onChange(); },
  });
  const selection = useEditorState({ editor, selector: ({ editor }) => {
    let rows = 0, cols = 0, references = 0;
    if (editor) {
      const position = editor.state.selection.$from;
      for (let depth = position.depth; depth > 0; depth--) if (position.node(depth).type.name === "table") {
        rows = position.node(depth).childCount; cols = position.node(depth).firstChild?.childCount ?? 0; break;
      }
      for (let depth = position.depth; depth > 0; depth--) if (position.node(depth).type.name === "bibliography") { references = position.node(depth).childCount; break; }
    }
    return { rows, cols, references, referenceType: editor?.isActive("citation") ? "citation" : editor?.isActive("bibliographyEntry") ? "bibliographyEntry" : null, bibliography: editor?.isActive("bibliography") ?? false, video: editor?.isActive("video") ?? false, callout: editor?.isActive("callout") ?? false };
  } });
  const buttons = [
    { label: "Жирный", command: () => editor?.chain().focus().toggleBold().run() },
    { label: "Курсив", command: () => editor?.chain().focus().toggleItalic().run() },
    ...([2, 3, 4] as const).map(level => ({ label: `H${level}`, command: () => editor?.chain().focus().toggleHeading({ level }).run() })),
    { label: "Список", command: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "Нумерация", command: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: "Цитата", command: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: "Код", command: () => editor?.chain().focus().toggleCodeBlock().run() },
    { label: "Разделитель", command: () => editor?.chain().focus().setHorizontalRule().run() },
    { label: "Отменить", command: () => editor?.chain().focus().undo().run() },
    { label: "Повторить", command: () => editor?.chain().focus().redo().run() },
  ];
  return <div className="rich-text-editor-shell">
    <p className="field-label">Основной текст</p>
    {!disabled ? <>
      <div className="rich-text-toolbar" role="toolbar" aria-label="Форматирование текста">
        {buttons.map(button => <button type="button" key={button.label} onClick={button.command} disabled={!editor}>{button.label}</button>)}
      </div>
      <div className="rich-text-insert">
        <label>Адрес ссылки<input inputMode="url" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://…" /></label>
        <button type="button" disabled={!editor || !safeLink(linkUrl)} onClick={() => editor?.chain().focus().setLink({ href: linkUrl }).run()}>Добавить ссылку</button>
        <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().unsetLink().run()}>Убрать ссылку</button>
      </div>
      <div className="rich-text-insert">
        <label>Изображение<select value={selectedImage} onChange={event => setSelectedImage(event.target.value)}>
          <option value="">Выберите из медиатеки</option>
          {media.filter(asset => asset.previewUrl && asset.status === "ready" && !asset.deletedAt).map(asset => <option key={asset.id} value={asset.id}>{asset.fileName}</option>)}
        </select></label>
        <label>Подпись<input value={caption} onChange={event => setCaption(event.target.value)} maxLength={1000} /></label>
        <button type="button" disabled={!editor || !selectedImage} onClick={() => {
          const asset = media.find(asset => asset.id === selectedImage);
          if (asset?.previewUrl) editor?.chain().focus().insertContent({ type: "image", attrs: { src: asset.previewUrl, mediaId: asset.id, alt: (locale === "Ru" ? asset.altRu : asset.altKk) ?? "", caption } }).run();
        }}>Вставить изображение</button>
      </div>
      <details className="rich-text-block-tools">
        <summary>Таблица, видео, выноска и научные источники</summary>
        <div className="rich-text-toolbar" role="toolbar" aria-label="Таблица">
          <button type="button" disabled={!editor || !!selection?.rows} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Вставить таблицу 3 × 3</button>
          <button type="button" disabled={!selection?.rows || selection.rows >= 50} onClick={() => editor?.chain().focus().addRowAfter().run()}>Добавить строку</button>
          <button type="button" disabled={!selection?.cols || selection.cols >= 20} onClick={() => editor?.chain().focus().addColumnAfter().run()}>Добавить столбец</button>
          <button type="button" disabled={!selection?.rows} onClick={() => editor?.chain().focus().deleteRow().run()}>Удалить строку</button>
          <button type="button" disabled={!selection?.cols} onClick={() => editor?.chain().focus().deleteColumn().run()}>Удалить столбец</button>
          <button type="button" disabled={!selection?.rows} onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>Строка заголовков</button>
          <button type="button" disabled={!selection?.rows} onClick={() => editor?.chain().focus().deleteTable().run()}>Удалить таблицу</button>
        </div>
        <p className="field-hint">До 50 строк и 20 столбцов, без объединённых ячеек. Для изменения выберите ячейку.</p>
        <div className="rich-text-insert">
          <label>Вид выноски<select value={calloutKind} onChange={event => setCalloutKind(event.target.value)}><option value="info">Информация</option><option value="warning">Внимание</option><option value="success">Результат</option></select></label>
          <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().toggleWrap("callout", { kind: calloutKind }).run()}>{selection?.callout ? "Убрать выноску" : "Добавить выноску"}</button>
          <button type="button" disabled={!selection?.callout} onClick={() => editor?.chain().focus().updateAttributes("callout", { kind: calloutKind }).run()}>Изменить вид выноски</button>
        </div>
        <div className="rich-text-insert">
          <label>Видео YouTube / Vimeo<input value={videoUrl} onChange={event => setVideoUrl(event.target.value)} inputMode="url" placeholder="https://youtu.be/…" /></label>
          <label>Название видео<input value={videoTitle} onChange={event => setVideoTitle(event.target.value)} maxLength={240} /></label>
          <label>Подпись видео<input value={videoCaption} onChange={event => setVideoCaption(event.target.value)} maxLength={1000} /></label>
          <button type="button" disabled={!editor || !embedUrl || !videoTitle.trim()} onClick={() => {
            const attrs = { src: embedUrl, title: videoTitle.trim(), caption: videoCaption.trim() || null };
            if (selection?.video) editor?.chain().focus().updateAttributes("video", attrs).run();
            else editor?.chain().focus().insertContent({ type: "video", attrs }).run();
          }}>{selection?.video ? "Сохранить видео" : "Вставить видео"}</button>
          <button type="button" disabled={!selection?.video} onClick={() => { const attrs = editor?.getAttributes("video"); setVideoUrl(String(attrs?.src ?? "")); setVideoTitle(String(attrs?.title ?? "")); setVideoCaption(String(attrs?.caption ?? "")); }}>Загрузить выбранное видео</button>
        </div>
        <div className="rich-text-insert">
          <label>Название / номер источника<input value={referenceLabel} onChange={event => setReferenceLabel(event.target.value)} maxLength={1000} /></label>
          <label>URL источника<input value={referenceLink} onChange={event => setReferenceLink(event.target.value)} inputMode="url" maxLength={2000} placeholder="https://…" /></label>
          <label>DOI<input value={doi} onChange={event => setDoi(event.target.value)} maxLength={200} placeholder="10.1234/example" /></label>
          <button type="button" disabled={!editor || !canReference} onClick={() => editor?.chain().focus().insertContent({ type: "citation", attrs: reference }).run()}>Вставить научную ссылку</button>
          <button type="button" disabled={!editor || !canReference || (selection?.references ?? 0) >= 100} onClick={() => {
            const entry = { type: "bibliographyEntry", attrs: reference };
            if (selection?.bibliography) {
              const position = editor!.state.selection.$from;
              for (let depth = position.depth; depth > 0; depth--) if (position.node(depth).type.name === "bibliography") {
                editor?.chain().focus().insertContentAt(position.end(depth), entry).run(); break;
              }
            } else editor?.chain().focus().insertContent({ type: "bibliography", attrs: { title: locale === "Ru" ? "Список литературы" : "Әдебиеттер тізімі" }, content: [entry] }).run();
          }}>Добавить в библиографию</button>
          <button type="button" disabled={!selection?.referenceType} onClick={() => {
            const attrs = editor?.getAttributes(selection!.referenceType!);
            setReferenceLabel(String(attrs?.label ?? "")); setReferenceLink(String(attrs?.url ?? "")); setDoi(String(attrs?.doi ?? ""));
          }}>Загрузить выбранный источник</button>
          <button type="button" disabled={!selection?.referenceType || !canReference} onClick={() => editor?.chain().focus().updateAttributes(selection!.referenceType!, reference).run()}>Сохранить источник</button>
          <button type="button" disabled={!selection?.referenceType && !selection?.video} onClick={() => {
            if (selection?.referenceType === "bibliographyEntry") {
              const position = editor!.state.selection.$from;
              for (let depth = position.depth; depth > 0; depth--) if (position.node(depth).type.name === "bibliography" && position.node(depth).childCount === 1) {
                editor?.chain().focus().deleteRange({ from: position.before(depth), to: position.after(depth) }).run(); return;
              }
            }
            editor?.chain().focus().deleteSelection().run();
          }}>Удалить выбранный блок</button>
        </div>
        <p className="field-hint">Укажите URL или DOI; при наличии DOI ссылка ведёт на doi.org. Выберите ссылку или запись списка для редактирования.{doi && !validDoi(doi.trim()) ? " Проверьте формат DOI." : ""}{canReference ? ` ${referenceUrl(reference)}` : ""}</p>
      </details>
    </> : null}
    <EditorContent editor={editor} />
    <input type="hidden" name={`contentJson${locale}`} value={JSON.stringify(document)} />
    <input type="hidden" name={`body${locale}`} value={richTextToPlainText(document)} />
    <p className="field-hint">{richTextToPlainText(document).trim().length} символов · минимум 20</p>
    {!richTextDocumentSchema.safeParse(document).success ? <p role="alert" className="form-error">Документ содержит неподдерживаемый блок или неверную ссылку. Исправьте содержимое перед сохранением.</p> : null}
  </div>;
}
