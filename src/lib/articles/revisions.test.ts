import { describe, expect, it } from "vitest";
import { snapshotComparison } from "./revisions";
import type { ArticleSnapshot } from "@/types/domain/article";

const translation = { title: "Заголовок", slug: "article", excerpt: "Описание", body: "Текст", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Текст" }] }] }, seoTitle: null, seoDescription: null };
const snapshot: ArticleSnapshot = { contentType: "article", categoryId: null, coverMediaId: null, tagIds: ["b", "a"], ru: translation, kk: { ...translation, title: "Тақырып" } };

describe("revision comparison", () => {
  it("detects changed credit roles, author order and primary category", () => {
    const authors = [{ authorId: "first", role: "author" as const }, { authorId: "second", role: "coauthor" as const }];
    const left = { ...snapshot, authors, categoryIds: ["first", "second"] };
    const right = { ...snapshot, authors: [...authors].reverse(), categoryIds: ["second", "first"] };
    expect(snapshotComparison(left, right, "ru").filter(field => field.changed).map(field => field.label)).toEqual(["Категории", "Авторы и роли"]);
    expect(snapshotComparison(left, { ...left, authors: [{ ...authors[0], role: "translator" }, authors[1]] }, "kk").some(field => field.label === "Авторы и роли" && field.changed)).toBe(true);
  });
  it("compares legacy single-category snapshots with the equivalent new selection", () => {
    expect(snapshotComparison({ ...snapshot, categoryId: "first" }, { ...snapshot, categoryId: "first", categoryIds: ["first"], authors: [] }, "ru").filter(field => field.changed)).toEqual([]);
  });
  it("ignores tag set and JSON object key order", () => {
    const reordered = { ...snapshot, tagIds: ["a", "b"], ru: { ...translation, contentJson: { content: [{ content: [{ text: "Текст", type: "text" }], type: "paragraph" }], type: "doc" } } };
    expect(snapshotComparison(snapshot, reordered, "ru").filter(field => field.changed)).toEqual([]);
  });
  it("detects formatting-only edits even when text stays the same", () => {
    const rich = { ...snapshot, ru: { ...translation, contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Текст", marks: [{ type: "bold" }] }] }] } } };
    expect(snapshotComparison(snapshot, rich, "ru").filter(field => field.changed).map(field => field.label)).toEqual(["Форматирование и изображения"]);
  });
  it("compares the selected language, SEO, slugs and article metadata", () => {
    const changed = { ...snapshot, categoryId: "category", ru: { ...translation, title: "Новый" }, kk: { ...snapshot.kk, slug: "new-kk", seoTitle: "SEO" } };
    expect(snapshotComparison(snapshot, changed, "kk").filter(field => field.changed).map(field => field.label)).toEqual(["Категории", "Адрес (slug)", "SEO-заголовок"]);
  });
  it("detects reordered document content and removed images", () => {
    const document = { type: "doc", content: [{ type: "image", attrs: { mediaId: "image" } }, { type: "paragraph", content: [{ type: "text", text: "Текст" }] }] };
    const left = { ...snapshot, ru: { ...translation, contentJson: document } };
    const right = { ...snapshot, ru: { ...translation, contentJson: { ...document, content: [...document.content].reverse() } } };
    expect(snapshotComparison(left, right, "ru").some(field => field.changed)).toBe(true);
    expect(snapshotComparison(left, snapshot, "ru").some(field => field.changed)).toBe(true);
  });
});
