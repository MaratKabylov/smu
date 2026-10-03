import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), update: vi.fn(), create: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/article.service", () => ({
  ArticleService: class { update = mocks.update; create = mocks.create; },
  ArticleServiceError: class extends Error { constructor(public code: string) { super(code); } },
}));
import { saveArticleDraft } from "./article.actions";
import { ArticleServiceError } from "@/server/services/article.service";

const id = "00000000-0000-4000-a000-000000000002";
function form() {
  const data = new FormData();
  data.set("contentType", "article"); data.set("categoryId", ""); data.set("coverMediaId", ""); data.set("expectedVersion", "3");
  for (const locale of ["Ru", "Kk"]) {
    data.set(`title${locale}`, "Scientific article"); data.set(`slug${locale}`, `article-${locale.toLowerCase()}`);
    data.set(`excerpt${locale}`, "A description of scientific research.");
    data.set(`body${locale}`, "A detailed explanation of regional scientific research and its results.");
    data.set(`seoTitle${locale}`, ""); data.set(`seoDescription${locale}`, "");
  }
  return data;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: id } });
  mocks.update.mockResolvedValue(4); mocks.create.mockResolvedValue(id);
});

describe("inline editorial saves", () => {
  it("returns the saved version without redirecting or creating a second article", async () => {
    expect(await saveArticleDraft(id, form())).toEqual({ ok: true, id, version: 4 });
    expect(mocks.update).toHaveBeenCalledWith({ userId: id }, id, expect.objectContaining({ expectedVersion: 3 }));
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.invalidate).toHaveBeenCalledWith("/journal", "layout");
  });
  it("creates a draft and returns its ID and initial version", async () => {
    expect(await saveArticleDraft(null, form())).toEqual({ ok: true, id, version: 1 });
    expect(mocks.create).toHaveBeenCalledOnce(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("denies a missing session before editorial writes", async () => {
    mocks.access.mockResolvedValue({ state: "unauthenticated" });
    expect(await saveArticleDraft(id, form())).toEqual({ ok: false, error: "forbidden" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("returns version conflicts so the client can preserve its form", async () => {
    mocks.update.mockRejectedValueOnce(new ArticleServiceError("stale_version", "Conflict"));
    expect(await saveArticleDraft(id, form())).toEqual({ ok: false, error: "stale_version" });
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("rejects missing versions, invalid JSON and unsafe structured links", async () => {
    const missing = form(); missing.delete("expectedVersion");
    const malformed = form(); malformed.set("contentJsonRu", "{broken");
    const unsafe = form(); unsafe.set("contentJsonRu", JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Scientific article with an unsafe link.", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }));
    for (const data of [missing, malformed, unsafe]) expect(await saveArticleDraft(id, data)).toEqual({ ok: false, error: "validation" });
    expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
});
