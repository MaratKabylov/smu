// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { articleEditorExtensions } from "./editor-extensions";
import { editorBlocksDocument, paragraph } from "./editor-blocks.fixture";
import { richTextDocumentSchema, richTextToPlainText } from "./rich-text";

const editors: Editor[] = [];
function create(content: object | string = { type: "doc", content: [paragraph("Research results for the article.")] }) {
  const editor = new Editor({ element: document.createElement("div"), extensions: articleEditorExtensions(), content });
  editors.push(editor); return editor;
}
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); });

describe("real TipTap block schema and editing", () => {
  it("loads and round-trips every block without losing structured data", () => {
    const editor = create(editorBlocksDocument);
    expect(richTextDocumentSchema.safeParse(editor.getJSON()).success).toBe(true);
    expect(richTextToPlainText(editor.getJSON())).toBe(richTextToPlainText(editorBlocksDocument));
    const copied = create(editor.getHTML());
    expect(copied.getJSON()).toEqual(editor.getJSON());
    expect(editor.getHTML()).not.toContain("<iframe");
  });
  it("edits a table with real row/column/header commands and undo/redo", () => {
    const editor = create();
    expect(editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })).toBe(true);
    expect(editor.commands.addRowAfter()).toBe(true);
    expect(editor.commands.addColumnAfter()).toBe(true);
    let table = richTextDocumentSchema.parse(editor.getJSON()).content!.find(node => node.type === "table")!;
    expect(table.content).toHaveLength(4); expect(table.content![0].content).toHaveLength(4);
    expect(editor.commands.toggleHeaderRow()).toBe(true);
    expect(editor.commands.deleteRow()).toBe(true);
    expect(editor.commands.deleteColumn()).toBe(true);
    table = richTextDocumentSchema.parse(editor.getJSON()).content!.find(node => node.type === "table")!;
    expect(table.content).toHaveLength(3); expect(table.content![0].content).toHaveLength(3);
    expect(richTextDocumentSchema.safeParse(editor.getJSON()).success).toBe(true);
    expect(editor.commands.deleteTable()).toBe(true);
    expect(editor.getJSON().content!.some(node => node.type === "table")).toBe(false);
    expect(editor.commands.undo()).toBe(true); expect(editor.commands.redo()).toBe(true);
  });
  it("wraps and unwraps existing text as callout without changing its body", () => {
    const editor = create(); const body = richTextToPlainText(editor.getJSON());
    expect(editor.commands.toggleWrap("callout", { kind: "warning" })).toBe(true);
    expect(editor.getJSON().content![0].type).toBe("callout");
    expect(richTextDocumentSchema.safeParse(editor.getJSON()).success).toBe(true);
    expect(editor.commands.toggleWrap("callout", { kind: "info" })).toBe(true);
    expect(richTextToPlainText(editor.getJSON()).trimEnd()).toBe(body);
  });
  it("updates reference and video attributes without corrupting adjacent text", () => {
    const editor = create(editorBlocksDocument);
    let referencePosition = 0, videoPosition = 0;
    editor.state.doc.descendants((node, pos) => { if (node.type.name === "bibliographyEntry" && !referencePosition) referencePosition = pos; if (node.type.name === "video") videoPosition = pos; });
    editor.commands.setNodeSelection(referencePosition);
    expect(editor.commands.updateAttributes("bibliographyEntry", { label: "Updated author", doi: "10.4321/new" })).toBe(true);
    editor.commands.setNodeSelection(videoPosition);
    expect(editor.commands.updateAttributes("video", { title: "Updated video", src: "https://player.vimeo.com/video/1234" })).toBe(true);
    expect(richTextDocumentSchema.safeParse(editor.getJSON()).success).toBe(true);
    expect(richTextToPlainText(editor.getJSON())).toContain("Updated author DOI: 10.4321/new");
    expect(richTextToPlainText(editor.getJSON())).toContain("Исследование / Зерттеу");
  });
});
