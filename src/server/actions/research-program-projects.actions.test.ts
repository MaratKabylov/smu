import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), save: vi.fn(), options: vi.fn(), path: vi.fn(), tag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error("redirect:" + path); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/research-program-projects.service", () => ({ ResearchProgramProjectsService: class { save = mocks.save; options = mocks.options; } }));
import { saveResearchProgramProjects, searchResearchProgramProjects } from "./research-program-projects.actions";
const id = "00000000-0000-4000-a000-000000000010";
const input = { expectedVersion: 4, workIds: [id], participants: [] };
const form = (value: unknown = input) => { const f = new FormData(); f.set("projects", typeof value === "string" ? value : JSON.stringify(value)); return f; };
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: id } }); });
it("saves validated graph and expires both public directions in every locale", async () => {
  await expect(saveResearchProgramProjects(id, form())).rejects.toThrow("saved=1#projects");
  expect(mocks.save).toHaveBeenCalledWith({ userId: id }, id, input);
  expect(mocks.tag).toHaveBeenCalledWith("smu:public-content:v1", { expire: 0 });
  for (const locale of ["ru", "kk", "en"]) for (const section of ["research-program", "projects"]) expect(mocks.path).toHaveBeenCalledWith(`/${locale}/${section}`, "layout");
});
it("rejects malformed, duplicate and unrelated participant input before DB mutation", async () => {
  for (const invalid of ["broken", "null", { ...input, workIds: [id, id] }, { ...input, expectedVersion: -1 }, { ...input, workIds: [], participants: [{ workId: id, applicationId: id, scientistId: id }] }])
    await expect(saveResearchProgramProjects(id, form(invalid))).rejects.toThrow("error=validation");
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.tag).not.toHaveBeenCalled();
});
it("leaves caches intact on Auth failures and stale version", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
  await expect(saveResearchProgramProjects(id, form())).rejects.toThrow("forbidden");
  mocks.save.mockRejectedValueOnce({ message: "stale_version" });
  await expect(saveResearchProgramProjects(id, form())).rejects.toThrow("error=stale_version#projects");
  expect(mocks.tag).not.toHaveBeenCalled(); expect(mocks.path).not.toHaveBeenCalled();
});
it("bounds search, catches repository failure and returns options after Auth", async () => {
  expect(await searchResearchProgramProjects("a".repeat(121))).toEqual({ ok: false });
  mocks.options.mockRejectedValueOnce(new Error("DB")); expect(await searchResearchProgramProjects("query")).toEqual({ ok: false });
  mocks.options.mockResolvedValueOnce([]); expect(await searchResearchProgramProjects(" query ")).toEqual({ ok: true, options: [] });
  expect(mocks.options).toHaveBeenLastCalledWith({ userId: id }, "query");
});
