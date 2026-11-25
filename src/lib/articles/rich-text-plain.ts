export type RichTextNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  marks?: Array<{ type: string; attrs?: Record<string, string | number | null> }>;
  content?: RichTextNode[];
};

export function plainTextDocument(text: string): RichTextNode {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

export function richTextToPlainText(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") return "";
  if (["citation", "bibliographyEntry"].includes(node.type)) {
    return `${node.attrs?.label ?? ""}${node.attrs?.doi ? ` DOI: ${node.attrs.doi}` : node.attrs?.url ? ` ${node.attrs.url}` : ""}`;
  }
  if (node.type === "video") {
    return [node.attrs?.title, node.attrs?.caption].filter(Boolean).join("\n");
  }
  const separator =
    node.type === "tableRow"
      ? "\t"
      : [
            "doc",
            "blockquote",
            "bulletList",
            "orderedList",
            "listItem",
            "table",
            "tableCell",
            "tableHeader",
            "callout",
            "bibliography",
          ].includes(node.type)
        ? "\n"
        : "";
  return (node.content ?? []).map(richTextToPlainText).join(separator);
}
