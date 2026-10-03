"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { plainTextDocument, richTextToPlainText, safeLink, type RichTextNode } from "@/lib/articles/rich-text";
import type { ArticleTranslation } from "@/types/domain/article";
import type { MediaAsset } from "@/types/domain/media";

const LibraryImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), mediaId: { default: null }, caption: { default: null } };
  },
});

export function RichTextEditor({ locale, value, disabled, media, onChange }: {
  locale: "Ru" | "Kk"; value?: ArticleTranslation; disabled: boolean;
  media: MediaAsset[]; onChange: () => void;
}) {
  const [document, setDocument] = useState<RichTextNode>(() => value?.contentJson ?? plainTextDocument(value?.body ?? ""));
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [caption, setCaption] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false } }), LibraryImage],
    content: document,
    editorProps: { attributes: { class: "rich-text-editor", role: "textbox", "aria-multiline": "true", "aria-label": `Основной текст ${locale.toUpperCase()}` } },
    onUpdate: ({ editor }) => { setDocument(editor.getJSON()); onChange(); },
  });
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
    </> : null}
    <EditorContent editor={editor} />
    <input type="hidden" name={`contentJson${locale}`} value={JSON.stringify(document)} />
    <input type="hidden" name={`body${locale}`} value={richTextToPlainText(document)} />
    <p className="field-hint">{richTextToPlainText(document).trim().length} символов · минимум 20</p>
  </div>;
}
