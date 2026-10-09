import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), save: vi.fn(), path: vi.fn(), tag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error("redirect:" + path); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/publication.service", () => ({ PublicationService: class { save = mocks.save; } }));
vi.mock("@/server/services/article.service", () => ({ ArticleServiceError: class extends Error { constructor(public code: string, message: string) { super(message); } } }));
import { savePublication } from "./publication.actions";
import { ArticleServiceError } from "@/server/services/article.service";
const id = "00000000-0000-4000-a000-000000000010";
const work = "00000000-0000-4000-a000-000000000011";
const form = () => { const data = new FormData(); for (const [key, value] of Object.entries({ scientistId: id, title: "Regional science publication", journal: "Journal", year: "2026", doi: "", url: "", publicationType: "article", status: "draft", coauthors: JSON.stringify([{ scientistId: null, name: "External Author", affiliation: "Institute" }]) })) data.set(key, value); data.append("workIds", work); return data; };
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: id } }); mocks.save.mockResolvedValue(id); });
describe("publication graph actions", () => {
  it("parses ordered authors and repeated work fields and immediately invalidates all public dependencies", async () => {
    const data = form(); data.append("workIds", id);
    await expect(savePublication(data)).rejects.toThrow("edit=" + id + "&saved=1");
    expect(mocks.save).toHaveBeenCalledWith({ userId: id }, null, expect.objectContaining({ coauthors: [{ scientistId: null, name: "External Author", affiliation: "Institute" }], workIds: [work, id] }));
    expect(mocks.tag).toHaveBeenCalledWith("smu:public-content:v1", { expire: 0 });
    for (const locale of ["ru", "kk", "en"]) for (const section of ["publications", "research", "projects", "scientists"]) expect(mocks.path).toHaveBeenCalledWith("/" + locale + "/" + section, "layout");
  });
  it("rejects malformed JSON and duplicate authors before accessing the database", async () => {
    for (const authors of ["{broken", "null", JSON.stringify([{ scientistId: id }])]) { const data = form(); data.set("coauthors", authors); await expect(savePublication(data)).rejects.toThrow("error=validation"); }
    expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.tag).not.toHaveBeenCalled();
  });
  it("does not invalidate after unauthorized sessions or a failed version check", async () => {
    mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); await expect(savePublication(form())).rejects.toThrow("/admin/login");
    const data = form(); data.set("id", id); data.set("expectedUpdatedAt", "2026-10-10T05:00:00.123456Z");
    mocks.save.mockRejectedValueOnce(new ArticleServiceError("stale_version", "Stale")); await expect(savePublication(data)).rejects.toThrow("error=stale_version");
    expect(mocks.tag).not.toHaveBeenCalled(); expect(mocks.path).not.toHaveBeenCalled();
  });
});
