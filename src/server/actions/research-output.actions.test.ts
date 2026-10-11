import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), save: vi.fn(), path: vi.fn(), tag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error("redirect:" + path); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/research-output.service", () => ({ ResearchOutputService: class { save = mocks.save; } }));
import { saveResearchOutput } from "./research-output.actions";
const id = "00000000-0000-4000-a000-000000000010";
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ kind: "dataset", status: "draft", versionLabel: "v1", license: "CC BY", changeNote: "", externalUrl: "", files: "[]",
    "ru.title": "Research results", "ru.description": "Meaningful description of research results", "kk.title": "Ғылыми нәтижелер", "kk.description": "Meaningful description of research results" })) data.set(key, value);
  data.append("workIds", id); return data;
};
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: id } }); mocks.save.mockResolvedValue(id); });
it("parses translations and file visibility and immediately invalidates all localized parent pages", async () => {
  const data = form(); data.set("files", JSON.stringify([{ id, isPublic: false }]));
  await expect(saveResearchOutput(data)).rejects.toThrow("edit=" + id + "&saved=1");
  expect(mocks.save).toHaveBeenCalledWith({ userId: id }, null, expect.objectContaining({ workIds: [id], files: [{ id, isPublic: false }], ru: { title: "Research results", description: "Meaningful description of research results" } }));
  expect(mocks.tag).toHaveBeenCalledWith("smu:public-content:v1", { expire: 0 });
  for (const locale of ["ru", "kk", "en"]) for (const section of ["research", "projects"]) expect(mocks.path).toHaveBeenCalledWith(`/${locale}/${section}`, "layout");
});
it("rejects invalid JSON, duplicate work links and incomplete English before Auth/DB", async () => {
  for (const file of ["broken", "null", JSON.stringify([{ id }])]) {
    const data = form(); data.set("files", file); await expect(saveResearchOutput(data)).rejects.toThrow("error=validation");
  }
  const duplicate = form(); duplicate.append("workIds", id); await expect(saveResearchOutput(duplicate)).rejects.toThrow("error=validation");
  const en = form(); en.set("en.title", "Only title"); await expect(saveResearchOutput(en)).rejects.toThrow("error=validation");
  expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
});
it("keeps cache untouched on Auth failures and stale-version rejection", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); await expect(saveResearchOutput(form())).rejects.toThrow("/admin/login");
  const data = form(); data.set("id", id); data.set("expectedVersion", "1");
  mocks.save.mockRejectedValueOnce({ message: "stale_version" });
  await expect(saveResearchOutput(data)).rejects.toThrow("edit=" + id + "&error=stale_version");
  expect(mocks.tag).not.toHaveBeenCalled(); expect(mocks.path).not.toHaveBeenCalled();
});
