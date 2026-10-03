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

export function plainTextDocument(text: string): RichTextNode {
  return { type: "doc", content: text.split("\n").map(line => ({
    type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}),
  })) };
}

export function richTextToPlainText(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") return "";
  const separator = ["doc", "blockquote", "bulletList", "orderedList", "listItem"].includes(node.type) ? "\n" : "";
  return (node.content ?? []).map(richTextToPlainText).join(separator);
}

const nodeSchema: z.ZodType<RichTextNode> = z.lazy(() => z.object({
  type: z.string(), text: z.string().max(200_000).optional(),
  attrs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  marks: z.array(z.object({ type: z.string(), attrs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional() }).strict()).max(8).optional(),
  content: z.array(nodeSchema).max(10_000).optional(),
}).strict());

const blocks = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock", "horizontalRule", "image"];
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
      parent === "listItem" ? blocks : parent === "codeBlock" ? ["text"] : ["text", "hardBreak"];
    if (!allowed.includes(node.type)) return false;
    if (node.type === "text" ? !node.text || !!node.content : node.text !== undefined) return false;
    if (["text", "hardBreak", "horizontalRule", "image"].includes(node.type) && node.content) return false;
    if (node.type === "heading" && ![2, 3, 4].includes(Number(node.attrs?.level))) return false;
    if (node.type === "image" && (!z.uuid().safeParse(node.attrs?.mediaId).success || (node.attrs?.src && !safeLink(node.attrs.src)))) return false;
    if (node.marks && (node.type !== "text" || node.marks.some(mark => !["bold", "italic", "strike", "underline", "code", "link"].includes(mark.type) || (mark.type === "link" && !safeLink(mark.attrs?.href))))) return false;
    return (node.content ?? []).every(child => valid(child, node.type));
  }
  if (!valid(parsed.data, null)) { ctx.addIssue({ code: "custom", message: "Недопустимый блок или ссылка." }); return z.NEVER; }
  return parsed.data;
});
