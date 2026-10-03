import { Fragment, type ReactNode } from "react";
import { plainTextDocument, richTextDocumentSchema, safeLink, type RichTextNode } from "@/lib/articles/rich-text";

export type RichTextImage = { id: string; url: string; alt: string; caption: string | null };

export function RichTextContent({ content, body, images = [] }: { content?: RichTextNode | null; body: string; images?: RichTextImage[] }) {
  const parsed = richTextDocumentSchema.safeParse(content);
  const document = parsed.success ? parsed.data : plainTextDocument(body);
  function render(node: RichTextNode, key: number): ReactNode {
    const children = node.content?.map(render);
    if (node.type === "text") {
      let result: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") result = <strong>{result}</strong>;
        if (mark.type === "italic") result = <em>{result}</em>;
        if (mark.type === "strike") result = <s>{result}</s>;
        if (mark.type === "underline") result = <u>{result}</u>;
        if (mark.type === "code") result = <code>{result}</code>;
        if (mark.type === "link" && safeLink(mark.attrs?.href)) result = <a href={mark.attrs.href} rel="noopener noreferrer">{result}</a>;
      }
      return <Fragment key={key}>{result}</Fragment>;
    }
    switch (node.type) {
      case "doc": return <Fragment key={key}>{children}</Fragment>;
      case "paragraph": return <p key={key}>{children ?? <br />}</p>;
      case "heading": {
        const Tag = `h${node.attrs?.level}` as "h2" | "h3" | "h4";
        return <Tag key={key}>{children}</Tag>;
      }
      case "bulletList": return <ul key={key}>{children}</ul>;
      case "orderedList": return <ol key={key} start={typeof node.attrs?.start === "number" ? node.attrs.start : 1}>{children}</ol>;
      case "listItem": return <li key={key}>{children}</li>;
      case "blockquote": return <blockquote key={key}>{children}</blockquote>;
      case "codeBlock": return <pre key={key}><code>{children}</code></pre>;
      case "horizontalRule": return <hr key={key} />;
      case "hardBreak": return <br key={key} />;
      case "image": {
        const asset = images.find(image => image.id === node.attrs?.mediaId);
        if (!asset) return null;
        const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption : asset.caption;
        return <figure key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : asset.alt} loading="lazy" />
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>;
      }
      default: return null;
    }
  }
  return <div className="rich-text-content">{render(document, 0)}</div>;
}
