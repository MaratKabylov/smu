import { beforeEach, expect, it, vi } from "vitest";
import type { AccessContext } from "@/types/domain/auth";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ server: vi.fn(), public: vi.fn(), get: vi.fn(), options: vi.fn(), save: vi.fn(), byProgram: vi.fn(), byProject: vi.fn(), configured: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.server }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.public }));
vi.mock("@/server/repositories/research-program-projects.repository", () => ({ ResearchProgramProjectsRepository: class {
  get = mocks.get; options = mocks.options; save = mocks.save; publicByProgram = mocks.byProgram; publicByProject = mocks.byProject;
} }));
import { ResearchProgramProjectsService } from "./research-program-projects.service";
const allowed: AccessContext = { userId: "manager", roles: new Set(), permissions: new Set(["admin.access", "research_program.manage"]) };
const id = "00000000-0000-4000-a000-000000000011";
beforeEach(() => { vi.clearAllMocks(); mocks.configured.mockReturnValue(true); });
it("checks both permissions before any client creation", async () => {
  const service = new ResearchProgramProjectsService();
  for (const permissions of [new Set<"admin.access">(["admin.access"]), new Set<"research_program.manage">(["research_program.manage"])]) {
    const denied = { ...allowed, permissions };
    await expect(service.get(denied, id)).rejects.toThrow("forbidden");
    await expect(service.options(denied, "query")).rejects.toThrow("forbidden");
    await expect(service.save(denied, id, { expectedVersion: 0, workIds: [], participants: [] })).rejects.toThrow("forbidden");
  }
  expect(mocks.server).not.toHaveBeenCalled();
});
it("retains selected projects outside first page and uses the session for writes", async () => {
  mocks.get.mockResolvedValue({ version: 2, workIds: [id], participants: [], applications: [] });
  mocks.options.mockResolvedValueOnce([{ id: "other", title: "Other" }]).mockResolvedValueOnce([{ id, title: "Selected" }]);
  const service = new ResearchProgramProjectsService();
  expect((await service.get(allowed, id)).options).toEqual([{ id: "other", title: "Other" }, { id, title: "Selected" }]);
  expect(mocks.options).toHaveBeenCalledWith("", [id]);
  await service.save(allowed, id, { expectedVersion: 2, workIds: [id], participants: [] });
  expect(mocks.save).toHaveBeenCalledWith(id, { expectedVersion: 2, workIds: [id], participants: [] });
});
it("uses anonymous public reads and returns empty when Supabase is absent", async () => {
  const service = new ResearchProgramProjectsService();
  await service.publicByProgram(id, "kk"); await service.publicByProject(id, "ru");
  expect(mocks.public).toHaveBeenCalledTimes(2); expect(mocks.server).not.toHaveBeenCalled();
  expect(mocks.byProgram).toHaveBeenCalledWith(id, "kk"); expect(mocks.byProject).toHaveBeenCalledWith(id, "ru");
  mocks.configured.mockReturnValue(false);
  expect(await service.publicByProgram(id, "en")).toEqual([]); expect(await service.publicByProject(id, "en")).toEqual([]);
});
