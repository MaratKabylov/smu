// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), fetch: vi.fn() }));
vi.mock("@/server/actions/research-output.actions", () => ({ searchOutputWorks: mocks.search }));
import { ResearchOutputAttachments } from "./ResearchOutputAttachments";
let container: HTMLFormElement, root: Root;
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("form"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const files = () => JSON.parse(String(new FormData(container).get("files")));
async function click(label: string) { const button = [...container.querySelectorAll("button")].find(b => b.textContent === label); expect(button).toBeDefined(); await act(async () => button!.click()); }
async function render() { await act(async () => root.render(<ResearchOutputAttachments initialWorkIds={["work"]} initialWorks={[{ id: "work", title: "Saved research", kind: "research", status: "published" }]} initialFiles={[{ id: "file", isPublic: false }]} initialUploads={[{ id: "file", file_name: "<script>.csv", file_size: 42 }]} />)); }
it("submits private visibility by default, safely renders names, and supports removal", async () => {
  await render(); expect(container.querySelector("script")).toBeNull(); expect(files()).toEqual([{ id: "file", isPublic: false }]);
  await act(async () => (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  expect(files()).toEqual([{ id: "file", isPublic: true }]);
  await click("Убрать файл"); expect(files()).toEqual([]);
  await click("Удалить связь"); expect(new FormData(container).getAll("workIds")).toEqual([]);
});
it("preserves selected work across subsequent search pages and errors", async () => {
  await render(); mocks.search.mockResolvedValueOnce({ ok: true, options: [{ id: "new", title: "New project", kind: "project", status: "draft" }] });
  await click("Найти работу"); expect(container.textContent).toContain("Saved research"); expect(container.textContent).toContain("New project");
  expect(new FormData(container).getAll("workIds")).toEqual(["work"]);
  mocks.search.mockRejectedValueOnce(new Error("Network")); await click("Найти работу");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Повторите поиск");
  expect(files()).toEqual([{ id: "file", isPublic: false }]);
});
it("attaches uploaded files as private and retains earlier attachments on upload failure", async () => {
  await render(); mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "uploaded", name: "data.csv", size: 42 }) });
  const picker = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(picker, "files", { value: [new File(["a,b\n1,2"], "data.csv", { type: "text/csv" })], configurable: true });
  await act(async () => picker.dispatchEvent(new Event("change", { bubbles: true })));
  expect(files()).toEqual([{ id: "file", isPublic: false }, { id: "uploaded", isPublic: false }]);
  mocks.fetch.mockResolvedValueOnce({ ok: false });
  await act(async () => picker.dispatchEvent(new Event("change", { bubbles: true })));
  expect(files()).toHaveLength(2); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не удалось загрузить");
});
