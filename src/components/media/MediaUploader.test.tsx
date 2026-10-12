// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn(), store: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabaseClient: () => ({ storage: { from: (bucket: string) => { expect(bucket).toBe("media-staging"); return { uploadToSignedUrl: mocks.store }; } } }) }));
import { MediaUploader } from "./MediaUploader";
let container: HTMLDivElement, root: Root;
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ bucket: "media-staging", mediaAssetId: "media", path: "owner/media", token: "ticket" }) }); mocks.store.mockResolvedValue({ error: null });
  await act(async () => root.render(<MediaUploader />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function choose(bucket: string) { await act(async () => { const select = container.querySelector("select")!; select.value = bucket; select.dispatchEvent(new Event("change", { bubbles: true })); }); }
async function upload(file: File) { await act(async () => { const input = container.querySelector("input")!; Object.defineProperty(input, "files", { value: [file], configurable: true }); input.dispatchEvent(new Event("change", { bubbles: true })); }); }
it("selects private document purpose and uploads only through a staging ticket", async () => {
  await choose("documents"); expect(container.textContent).toContain("50 МБ"); expect(container.querySelector("input")?.accept).toContain("application/pdf");
  await upload(new File(["%PDF-1.7"], "paper.pdf", { type: "application/pdf" }));
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({ bucket: "documents", fileName: "paper.pdf" });
  expect(mocks.store).toHaveBeenCalledWith("owner/media", "ticket", expect.any(File), expect.objectContaining({ contentType: "application/pdf" }));
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({ mediaAssetId: "media" });
  expect(mocks.refresh).toHaveBeenCalledOnce(); expect(container.textContent).toContain("Файл добавлен");
});
it("rejects incompatible files before networking and reports network errors", async () => {
  await choose("publication-files"); await upload(new File(["a,b"], "data.csv", { type: "text/csv" }));
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(container.textContent).toContain("Проверьте формат");
  mocks.fetch.mockRejectedValueOnce(new Error("offline")); await upload(new File(["%PDF-"], "paper.pdf", { type: "application/pdf" }));
  expect(container.textContent).toContain("Не удалось загрузить"); expect(mocks.refresh).not.toHaveBeenCalled();
});
