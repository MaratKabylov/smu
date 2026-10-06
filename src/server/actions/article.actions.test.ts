import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), update: vi.fn(), create: vi.fn(), schedule: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/article.service", () => ({
  ArticleService: class { update = mocks.update; create = mocks.create; schedule = mocks.schedule; },
  ArticleServiceError: class extends Error { constructor(public code: string) { super(code); } },
}));
import { saveArticleDraft, scheduleArticle } from "./article.actions";
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
  it("schedules the selected Kazakhstan time and retains the original concurrency tokens", async () => {
    const data = new FormData(); data.set("scheduledAt", "2099-10-07T00:15");
    await expect(scheduleArticle(id, 3, "2099-10-06T07:00:00Z", data)).rejects.toThrow(`redirect:/admin/content/articles/${id}?schedule_saved=1`);
    expect(mocks.schedule).toHaveBeenCalledWith({ userId: id }, id, {
      expectedVersion: 3, expectedScheduledAt: "2099-10-06T07:00:00.000Z", scheduledAt: "2099-10-06T19:15:00.000Z",
    });
    expect(mocks.invalidate).toHaveBeenCalledWith("/admin/content/articles", "layout");
  });
  it("cancels explicitly without requiring the date field", async () => {
    const data = new FormData(); data.set("intent", "cancel");
    await expect(scheduleArticle(id, 3, "2099-10-06T07:00:00Z", data)).rejects.toThrow("schedule_saved=1");
    expect(mocks.schedule).toHaveBeenCalledWith(expect.anything(), id, {
      expectedVersion: 3, expectedScheduledAt: "2099-10-06T07:00:00.000Z", scheduledAt: null,
    });
  });
  it("rejects invalid schedule fields before authenticating or writing", async () => {
    const invalidDate = new FormData(); invalidDate.set("scheduledAt", "2026-02-30T12:00");
    const validDate = new FormData(); validDate.set("scheduledAt", "2099-10-07T12:00");
    await expect(scheduleArticle(id, 3, null, invalidDate)).rejects.toThrow("error=validation");
    await expect(scheduleArticle(id, 0, null, validDate)).rejects.toThrow("error=validation");
    await expect(scheduleArticle(id, 3, "invalid", validDate)).rejects.toThrow("error=validation");
    expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it("requires a session for scheduling and preserves scheduling conflicts", async () => {
    const data = new FormData(); data.set("scheduledAt", "2099-10-07T12:00");
    mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
    await expect(scheduleArticle(id, 3, null, data)).rejects.toThrow("redirect:/admin/login");
    expect(mocks.schedule).not.toHaveBeenCalled();
    mocks.schedule.mockRejectedValueOnce(new ArticleServiceError("stale_version", "Conflict"));
    await expect(scheduleArticle(id, 3, null, data)).rejects.toThrow("error=stale_version");
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("passes relations through autosave and invalidates reverse-link pages", async () => {
    const data = form(); const relations = [{ kind: "scientist", entityId: id, relationType: "expert" }];
    data.set("relations", JSON.stringify(relations));
    expect(await saveArticleDraft(id, data)).toMatchObject({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), id, expect.objectContaining({ relations }));
    for (const path of ["/scientists", "/projects", "/research", "/events", "/publications"]) expect(mocks.invalidate).toHaveBeenCalledWith(path, "layout");
  });
  it("rejects malformed, duplicate and invalid-role relations before any writes", async () => {
    for (const relations of ["{broken", "null", JSON.stringify([{ kind: "scientist", entityId: id, relationType: "owner" }]), JSON.stringify(Array(2).fill({ kind: "project", entityId: id, relationType: "subject" }))]) {
      const data = form(); data.set("relations", relations);
      expect(await saveArticleDraft(id, data)).toEqual({ ok: false, error: "validation" });
    }
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.access).not.toHaveBeenCalled();
  });
  it("distinguishes an omitted relation field from explicit clearing", async () => {
    const data = form(); await saveArticleDraft(id, data);
    expect(mocks.update.mock.calls[0][2].relations).toBeUndefined();
    data.set("relations", "[]"); await saveArticleDraft(id, data);
    expect(mocks.update.mock.calls[1][2].relations).toEqual([]);
  });
  it("passes ordered credits and categories through autosave for a managed type", async () => {
    const data = form(); data.set("creditsVersion", "1"); data.set("contentType", "report");
    data.append("categoryIds", id); data.set("authors", JSON.stringify([{ authorId: id, role: "translator" }]));
    expect(await saveArticleDraft(id, data)).toMatchObject({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), id, expect.objectContaining({ contentType: "report", categoryIds: [id], authors: [{ authorId: id, role: "translator" }] }));
  });
  it("refuses malformed credits and preserves an explicit empty selection", async () => {
    const data = form(); data.set("creditsVersion", "1"); data.set("authors", "{broken");
    expect(await saveArticleDraft(id, data)).toEqual({ ok: false, error: "validation" });
    expect(mocks.update).not.toHaveBeenCalled();
    data.set("authors", "[]"); await saveArticleDraft(id, data);
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), id, expect.objectContaining({ authors: [], categoryIds: [] }));
  });
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
