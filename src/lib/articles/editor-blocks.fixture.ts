import type { RichTextNode } from "./rich-text";

export const paragraph = (text: string): RichTextNode => ({ type: "paragraph", content: [{ type: "text", text }] });
export const cell = (text: string): RichTextNode => ({ type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph(text)] });
export const editorBlocksDocument: RichTextNode = { type: "doc", content: [
  { type: "paragraph", content: [{ type: "text", text: "Исследование / Зерттеу " }, { type: "citation", attrs: { label: "1", doi: "10.1234/results.v2", url: null } }] },
  { type: "table", content: [
    { type: "tableRow", content: [{ ...cell("Показатель"), type: "tableHeader" }, { ...cell("Значение"), type: "tableHeader" }] },
    { type: "tableRow", content: [cell("Температура"), cell("24 °C")] },
  ] },
  { type: "callout", attrs: { kind: "warning" }, content: [paragraph("Учтите погрешность измерения.")] },
  { type: "video", attrs: { src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", title: "Методика исследования", caption: "Демонстрация опыта" } },
  { type: "bibliography", attrs: { title: "Список литературы / Әдебиеттер тізімі" }, content: [
    { type: "bibliographyEntry", attrs: { label: "Автор. Научные результаты.", doi: "10.1234/results.v2", url: "https://example.kz/paper" } },
    { type: "bibliographyEntry", attrs: { label: "Открытые данные", doi: null, url: "https://example.kz/dataset" } },
  ] },
] };

export const invalidEditorBlocks: Array<[string, RichTextNode]> = [
  ["arbitrary video host", { type: "video", attrs: { src: "https://evil.example/embed/dQw4w9WgXcQ", title: "Video" } }],
  ["host suffix", { type: "video", attrs: { src: "https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ", title: "Video" } }],
  ["video parameters", { type: "video", attrs: { src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1", title: "Video" } }],
  ["video without title", { type: "video", attrs: { src: "https://player.vimeo.com/video/123" } }],
  ["unsafe reference", { type: "bibliography", content: [{ type: "bibliographyEntry", attrs: { label: "Unsafe", url: "javascript:alert(1)" } }] }],
  ["unsafe URL even with DOI", { type: "bibliography", content: [{ type: "bibliographyEntry", attrs: { label: "Unsafe", doi: "10.1234/safe", url: "data:text/html,bad" } }] }],
  ["DOI injection", { type: "bibliography", content: [{ type: "bibliographyEntry", attrs: { label: "Unsafe", doi: "10.1234/evil\"onclick=alert(1)" } }] }],
  ["reference without address", { type: "bibliography", content: [{ type: "bibliographyEntry", attrs: { label: "No address" } }] }],
  ["reference without label", { type: "bibliography", content: [{ type: "bibliographyEntry", attrs: { doi: "10.1234/example" } }] }],
  ["empty bibliography", { type: "bibliography", content: [] }],
  ["unknown callout kind", { type: "callout", attrs: { kind: "<script>" }, content: [paragraph("unsafe")] }],
  ["empty callout", { type: "callout", attrs: { kind: "info" } }],
  ["empty table", { type: "table", content: [] }],
  ["uneven table", { type: "table", content: [{ type: "tableRow", content: [cell("a"), cell("b")] }, { type: "tableRow", content: [cell("c")] }] }],
  ["merged cells", { type: "table", content: [{ type: "tableRow", content: [{ ...cell("a"), attrs: { colspan: 2 } }] }] }],
  ["row spans", { type: "table", content: [{ type: "tableRow", content: [{ ...cell("a"), attrs: { rowspan: 2 } }] }] }],
  ["empty cell", { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell" }] }] }],
  ["row outside table", { type: "tableRow", content: [cell("a")] }],
  ["reference outside bibliography", { type: "bibliographyEntry", attrs: { label: "Paper", doi: "10.1234/paper" } }],
  ["citation with nested HTML", { type: "paragraph", content: [{ type: "citation", attrs: { label: "1", doi: "10.1234/paper" }, content: [paragraph("<script>")] }] }],
  ["too many rows", { type: "table", content: Array.from({ length: 51 }, () => ({ type: "tableRow", content: [cell("a")] })) }],
  ["too many columns", { type: "table", content: [{ type: "tableRow", content: Array.from({ length: 21 }, () => cell("a")) }] }],
  ["too many references", { type: "bibliography", content: Array.from({ length: 101 }, () => ({ type: "bibliographyEntry", attrs: { label: "1", doi: "10.1234/paper" } })) }],
];
