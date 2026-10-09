// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/server/actions/article-relations.actions", () => ({ searchArticleRelations: mocks.search }));
import { PublicationRelationsEditor } from "./PublicationRelationsEditor";
import type { ArticleRelationOption } from "@/types/domain/article-relations";
const author = { scientistId: "scientist", name: "", affiliation: "" };
const external = { scientistId: null, name: "External <Author>", affiliation: "Institute" };
const scientist: ArticleRelationOption = { kind: "scientist", entityId: "scientist", titleRu: "Учёный", titleKk: "Ғалым" };
let container: HTMLFormElement, root: Root;
beforeEach(() => { vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("form"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const authors = () => JSON.parse(String(new FormData(container).get("coauthors")));
async function click(label: string) { const button = [...container.querySelectorAll("button")].find(b => b.textContent === label || b.getAttribute("aria-label") === label); expect(button).toBeDefined(); await act(async () => button!.click()); }
describe("publication relation editor", () => {
  it("submits author order and repeated work fields after reorder/removal, safely rendering external names", async () => {
    await act(async () => root.render(<PublicationRelationsEditor scientists={[scientist]} works={[]} coauthors={[author, external]} workIds={["research", "project"]} />));
    expect(container.querySelector("author")).toBeNull(); expect(authors()).toEqual([author, external]);
    expect(new FormData(container).getAll("workIds")).toEqual(["research", "project"]);
    await click("Переместить автора 2 выше"); expect(authors()).toEqual([external, author]);
    await click("Удалить автора 2"); expect(authors()).toEqual([external]);
    await click("Убрать связь"); expect(new FormData(container).getAll("workIds")).toEqual(["project"]);
  });
  it("preserves selected scientists/works when subsequent searches return different pages", async () => {
    await act(async () => root.render(<PublicationRelationsEditor scientists={[scientist]} works={[{ kind: "research", entityId: "research", titleRu: "Сохранённая работа", titleKk: "Жұмыс" }]} coauthors={[author]} workIds={["research"]} />));
    mocks.search.mockResolvedValueOnce({ ok: true, options: [] }); await click("Найти соавтора");
    expect(container.textContent).toContain("Учёный"); expect(authors()).toEqual([author]);
    mocks.search.mockResolvedValueOnce({ ok: true, options: [] }).mockResolvedValueOnce({ ok: true, options: [{ kind: "project", entityId: "new-project", titleRu: "Новый проект", titleKk: "Жоба" }] }); await click("Найти научную работу");
    expect(container.textContent).toContain("Сохранённая работа"); expect(container.textContent).toContain("Новый проект");
    expect(new FormData(container).getAll("workIds")).toEqual(["research"]);
  });
  it("shows search failures while retaining the form and allows inaccessible saved links to be removed", async () => {
    await act(async () => root.render(<PublicationRelationsEditor scientists={[]} works={[]} coauthors={[author]} workIds={["unavailable"]} />));
    mocks.search.mockRejectedValueOnce(new Error("Network")); await click("Найти соавтора");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Повторите попытку");
    expect(authors()).toEqual([author]); await click("Удалить автора 1"); await click("Убрать связь");
    expect(authors()).toEqual([]); expect(new FormData(container).getAll("workIds")).toEqual([]);
  });
});
