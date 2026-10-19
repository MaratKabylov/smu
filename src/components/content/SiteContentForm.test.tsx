// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SiteContentForm } from "./SiteContentForm";
import type { ContentPage } from "@/lib/validation/site-content";

let container: HTMLDivElement, root: Root;
const page: ContentPage = { key: "about", template: "standard", version: 0, status: "draft", updated_at: "now", translations: [] };
const input = (name: string) => container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("disables duplicate submission, retains content after errors and never advances a failed version", async () => {
  let finish!: (result: { error?: string; version?: number }) => void;
  const action = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<SiteContentForm kind="page" record={page} action={action} />));
  input("title_ru").value = "Edited title"; input("body_ru").value = "Paragraph";
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(container.querySelector("fieldset")!.disabled).toBe(true); expect(container.querySelector("button")!.disabled).toBe(true);
  await act(async () => finish({ error: "stale_version" }));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("уже изменена");
  expect(input("title_ru").value).toBe("Edited title"); expect(input("body_ru").value).toBe("Paragraph");
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(action.mock.calls[1][0].version).toBe(0);
  await act(async () => finish({ version: 1 }));
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(action.mock.calls[2][0].version).toBe(1);
  await act(async () => finish({ version: 2 }));
});
it("retains checkbox state and translates section controls into bounded numeric inputs", async () => {
  const action = vi.fn().mockResolvedValue({ error: "save_failed" });
  await act(async () => root.render(<SiteContentForm kind="section" record={{ key: "hero", enabled: true, sort_order: 2, display_limit: 3, titles: {}, version: 0, updated_at: "now" }} action={action} />));
  input("enabled").checked = false; input("title_kk").value = "Ғылым";
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(action.mock.calls[0][0].data).toMatchObject({ enabled: false, sort_order: 2, display_limit: 3, titles: { kk: "Ғылым" } });
  expect(input("enabled").checked).toBe(false); expect(input("title_kk").value).toBe("Ғылым");
});
it("provides labelled social-link controls and retains partially entered links for server validation", async () => {
  const action = vi.fn().mockResolvedValue({ error: "invalid_input" });
  await act(async () => root.render(<SiteContentForm kind="setting" record={{ key: "social_links", value: [], version: 0, updated_at: "now" }} action={action} />));
  input("label_0").value = "Science"; input("href_0").value = "https://example.org"; input("label_1").value = "Incomplete";
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(action.mock.calls[0][0].data.value).toEqual([{ label: "Science", href: "https://example.org" }, { label: "Incomplete", href: "" }]);
  expect(input("label_1").value).toBe("Incomplete");
});
