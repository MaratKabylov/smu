import { z } from "zod";

export type RichTextNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  marks?: Array<{ type: string; attrs?: Record<string, string | number | null> }>;
  content?: RichTextNode[];
};

export function safeLink(value: unknown): value is string {
  return typeof value === "string" && /^(https?:\/\/|mailto:)/i.test(value) && !/[\u0000-\u0020]/.test(value);
}

export function safeHttpLink(value: unknown): value is string {
  if (!safeLink(value) || !/^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#].*)?$/i.test(value)) return false;
  try { const url = new URL(value); return !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}

// Store only canonical player URLs; never accept arbitrary iframe HTML or hosts.
export function videoEmbedUrl(value: string): string | null {
  if (!safeHttpLink(value)) return null;
  const url = new URL(value);
  if (url.port) return null;
  let id: string | null = null;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:embed|shorts)\/([\w-]{11})$/.exec(url.pathname)?.[1] ?? null;
  } else if (url.hostname === "youtu.be") id = url.pathname.slice(1);
  else if (["www.youtube-nocookie.com", "youtube-nocookie.com"].includes(url.hostname)) id = /^\/embed\/([\w-]{11})$/.exec(url.pathname)?.[1] ?? null;
  if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
    const vimeoId = /^\/(?:video\/)?([1-9][0-9]{0,11})$/.exec(url.pathname)?.[1];
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  }
  return null;
}

export function validDoi(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200 && /^10\.\d{4,9}\/[a-z0-9._;()/:\-]+$/i.test(value);
}

export function referenceUrl(attrs?: RichTextNode["attrs"]): string | null {
  return validDoi(attrs?.doi) ? `https://doi.org/${attrs.doi}` : safeHttpLink(attrs?.url) ? attrs.url : null;
}

function validReference(attrs?: RichTextNode["attrs"]): boolean {
  return typeof attrs?.label === "string" && attrs.label.trim().length > 0 && attrs.label.length <= 1000 &&
    (attrs.url == null || attrs.url === "" || (safeHttpLink(attrs.url) && attrs.url.length <= 2000)) &&
    (attrs.doi == null || attrs.doi === "" || validDoi(attrs.doi)) && referenceUrl(attrs) !== null;
}

export function plainTextDocument(text: string): RichTextNode {
  return { type: "doc", content: text.split("\n").map(line => ({
    type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}),
  })) };
}

export function richTextToPlainText(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") return "";
  if (["citation", "bibliographyEntry"].includes(node.type)) return `${node.attrs?.label ?? ""}${node.attrs?.doi ? ` DOI: ${node.attrs.doi}` : node.attrs?.url ? ` ${node.attrs.url}` : ""}`;
  if (node.type === "video") return [node.attrs?.title, node.attrs?.caption].filter(Boolean).join("\n");
  const separator = node.type === "tableRow" ? "\t" : ["doc", "blockquote", "bulletList", "orderedList", "listItem", "table", "tableCell", "tableHeader", "callout", "bibliography"].includes(node.type) ? "\n" : "";
  return (node.content ?? []).map(richTextToPlainText).join(separator);
}

const nodeSchema: z.ZodType<RichTextNode> = z.lazy(() => z.object({
  type: z.string(), text: z.string().max(200_000).optional(),
  attrs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  marks: z.array(z.object({ type: z.string(), attrs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional() }).strict()).max(8).optional(),
  content: z.array(nodeSchema).max(10_000).optional(),
}).strict());

const blocks = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock", "horizontalRule", "image", "table", "video", "callout", "bibliography"];
export const richTextDocumentSchema = z.unknown().transform((value, ctx): RichTextNode => {
  // Bound recursion before the recursive Zod schema sees untrusted input.
  let count = 0;
  function bounded(node: unknown, depth: number): boolean {
    if (depth > 20 || ++count > 10_000 || !node || typeof node !== "object") return false;
    const children = (node as RichTextNode).content;
    return children === undefined || (Array.isArray(children) && children.every(child => bounded(child, depth + 1)));
  }
  if (!bounded(value, 0) || JSON.stringify(value).length > 1_000_000) {
    ctx.addIssue({ code: "custom", message: "Документ слишком большой или глубоко вложен." });
    return z.NEVER;
  }
  const parsed = nodeSchema.safeParse(value);
  if (!parsed.success) { ctx.addIssue({ code: "custom", message: "Некорректный документ." }); return z.NEVER; }
  function valid(node: RichTextNode, parent: string | null): boolean {
    const allowed = parent === null ? ["doc"] :
      ["doc", "blockquote"].includes(parent) ? blocks :
      ["bulletList", "orderedList"].includes(parent) ? ["listItem"] :
      ["listItem", "tableCell", "tableHeader", "callout"].includes(parent) ? blocks :
      parent === "table" ? ["tableRow"] : parent === "tableRow" ? ["tableCell", "tableHeader"] :
      parent === "bibliography" ? ["bibliographyEntry"] : parent === "codeBlock" ? ["text"] : ["text", "hardBreak", "citation"];
    if (!allowed.includes(node.type)) return false;
    if (node.type === "text" ? !node.text || !!node.content : node.text !== undefined) return false;
    if (["text", "hardBreak", "horizontalRule", "image", "video", "citation", "bibliographyEntry"].includes(node.type) && node.content) return false;
    if (node.type === "heading" && ![2, 3, 4].includes(Number(node.attrs?.level))) return false;
    if (node.type === "image" && (!z.uuid().safeParse(node.attrs?.mediaId).success || (node.attrs?.src && !safeLink(node.attrs.src)))) return false;
    if (node.type === "video" && (typeof node.attrs?.src !== "string" || videoEmbedUrl(node.attrs.src) !== node.attrs.src || typeof node.attrs?.title !== "string" || !node.attrs.title.trim() || node.attrs.title.length > 240 || (node.attrs.caption != null && (typeof node.attrs.caption !== "string" || node.attrs.caption.length > 1000)))) return false;
    if (["citation", "bibliographyEntry"].includes(node.type) && !validReference(node.attrs)) return false;
    if (node.type === "bibliography" && (!node.content?.length || node.content.length > 100 || (node.attrs?.title != null && (typeof node.attrs.title !== "string" || node.attrs.title.length > 240)))) return false;
    if (node.type === "callout" && (!node.content?.length || !["info", "warning", "success"].includes(String(node.attrs?.kind)))) return false;
    if (node.type === "table") {
      const rows = node.content ?? [];
      const width = rows[0]?.content?.length ?? 0;
      if (!rows.length || rows.length > 50 || !width || width > 20 || rows.some(row => row.content?.length !== width)) return false;
    }
    if (["tableCell", "tableHeader"].includes(node.type) && (!node.content?.length || (node.attrs?.colspan != null && node.attrs.colspan !== 1) || (node.attrs?.rowspan != null && node.attrs.rowspan !== 1) || node.attrs?.colwidth != null)) return false;
    if (node.marks && (node.type !== "text" || node.marks.some(mark => !["bold", "italic", "strike", "underline", "code", "link"].includes(mark.type) || (mark.type === "link" && !safeLink(mark.attrs?.href))))) return false;
    return (node.content ?? []).every(child => valid(child, node.type));
  }
  if (!valid(parsed.data, null)) { ctx.addIssue({ code: "custom", message: "Недопустимый блок или ссылка." }); return z.NEVER; }
  return parsed.data;
});
