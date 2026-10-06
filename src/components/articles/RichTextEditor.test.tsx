// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./RichTextEditor";
import { richTextDocumentSchema, richTextToPlainText, type RichTextNode } from "@/lib/articles/rich-text";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  // jsdom does not implement selection geometry used by ProseMirror's scrolling.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function mount(locale: "Ru" | "Kk" = "Ru", disabled = false) {
  const onChange = vi.fn();
  await act(async () => { root.render(<RichTextEditor locale={locale} disabled={disabled} media={[]} onChange={onChange} />); });
  return onChange;
}
function button(label: string) {
  const result = [...host.querySelectorAll("button")].find(item => item.textContent === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}
async function click(label: string) { await act(async () => button(label).click()); }
async function input(label: string, value: string) {
  const field = [...host.querySelectorAll("label")].find(item => item.textContent?.startsWith(label))?.querySelector("input");
  if (!field) throw new Error(`Missing input: ${label}`);
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
}
function documentValue(locale = "Ru"): RichTextNode {
  return JSON.parse(host.querySelector<HTMLInputElement>(`input[name="contentJson${locale}"]`)!.value);
}
function editorInstance(): Editor { return (host.querySelector(".tiptap") as HTMLElement & { editor: Editor }).editor; }

describe("interactive bilingual block controls", () => {
  it.each(["Ru", "Kk"] as const)("inserts bibliography and submits JSON plus derived body in %s", async locale => {
    const onChange = await mount(locale);
    expect(button("Добавить в библиографию").disabled).toBe(true);
    await input("Название / номер источника", "Научный источник"); await input("DOI", "10.1234/results");
    expect(button("Добавить в библиографию").disabled).toBe(false);
    await click("Добавить в библиографию");
    const value = documentValue(locale);
    expect(value.content!.find(item => item.type === "bibliography")!.attrs!.title).toBe(locale === "Ru" ? "Список литературы" : "Әдебиеттер тізімі");
    expect(richTextDocumentSchema.safeParse(value).success).toBe(true);
    expect(host.querySelector<HTMLInputElement>(`input[name="body${locale}"]`)!.value).toBe(richTextToPlainText(value));
    expect(onChange).toHaveBeenCalled();
    const editor = editorInstance(); let pos = 0;
    editor.state.doc.descendants((node, position) => { if (node.type.name === "bibliographyEntry") pos = position; });
    await act(async () => { editor.commands.setNodeSelection(pos); });
    await click("Загрузить выбранный источник");
    await input("Название / номер источника", "Исправленный источник"); await click("Сохранить источник");
    expect(richTextToPlainText(documentValue(locale))).toContain("Исправленный источник DOI: 10.1234/results");
    await click("Удалить выбранный блок");
    expect(documentValue(locale).content!.some(node => node.type === "bibliography")).toBe(false);
    expect(richTextDocumentSchema.safeParse(documentValue(locale)).success).toBe(true);
  });
  it("inserts and updates a canonical video and prevents unsafe URLs", async () => {
    await mount();
    await input("Название видео", "Scientific method"); await input("Видео YouTube", "https://evil.example/video");
    expect(button("Вставить видео").disabled).toBe(true);
    await input("Видео YouTube", "https://youtu.be/dQw4w9WgXcQ?autoplay=1"); await click("Вставить видео");
    expect(documentValue().content!.find(node => node.type === "video")!.attrs!.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    const editor = editorInstance(); let pos = 0;
    editor.state.doc.descendants((node, position) => { if (node.type.name === "video") pos = position; });
    await act(async () => { editor.commands.setNodeSelection(pos); });
    await click("Загрузить выбранное видео"); await input("Название видео", "Updated method"); await click("Сохранить видео");
    expect(richTextToPlainText(documentValue())).toContain("Updated method");
    expect(richTextDocumentSchema.safeParse(documentValue()).success).toBe(true);
  });
  it("appends to the selected bibliography and deletes a source without losing siblings", async () => {
    await mount();
    await input("Название / номер источника", "First source"); await input("DOI", "10.1234/first"); await click("Добавить в библиографию");
    const editor = editorInstance();
    async function selectFirst() {
      let pos = -1;
      editor.state.doc.descendants((node, position) => { if (node.type.name === "bibliographyEntry" && pos === -1) pos = position; });
      await act(async () => { editor.commands.setNodeSelection(pos); });
    }
    await selectFirst();
    await input("Название / номер источника", "Second source"); await input("DOI", "10.1234/second"); await click("Добавить в библиографию");
    const bibliography = documentValue().content!.filter(node => node.type === "bibliography");
    expect(bibliography).toHaveLength(1); expect(bibliography[0].content).toHaveLength(2);
    await selectFirst(); await click("Удалить выбранный блок");
    expect(richTextToPlainText(documentValue())).toContain("Second source DOI: 10.1234/second");
    expect(richTextToPlainText(documentValue())).not.toContain("First source");
    expect(richTextDocumentSchema.safeParse(documentValue()).success).toBe(true);
  });
  it("uses table controls and keeps each change in the submitted document", async () => {
    await mount(); await click("Вставить таблицу 3 × 3");
    expect(button("Добавить строку").disabled).toBe(false);
    await click("Добавить строку"); await click("Добавить столбец");
    const table = documentValue().content!.find(node => node.type === "table")!;
    expect(table.content).toHaveLength(4); expect(table.content![0].content).toHaveLength(4);
    expect(richTextDocumentSchema.safeParse(documentValue()).success).toBe(true);
    await click("Удалить таблицу"); expect(documentValue().content!.some(node => node.type === "table")).toBe(false);
  });
  it("hides mutation controls and uses a read-only editor when disabled", async () => {
    const onChange = await mount("Ru", true);
    expect(host.querySelector("button")).toBeNull();
    expect(editorInstance().isEditable).toBe(false); expect(onChange).not.toHaveBeenCalled();
  });
});
