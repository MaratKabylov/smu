import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ server: vi.fn(), privileged: vi.fn(), save: vi.fn(), update: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.server }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.privileged }));
vi.mock("@/server/repositories/research-program.repository", () => ({ ResearchProgramRepository: class { save = mocks.save; updateApplication = mocks.update; list = mocks.list; } }));
import { ResearchProgramService } from "./research-program.service";
import type { AccessContext } from "@/types/domain/auth";
import type { ResearchProgramInput } from "@/lib/validation/research-program";
const forbidden: AccessContext = { userId: "user", roles: new Set(["project_manager"]), permissions: new Set(["admin.access", "projects.manage"]) };
const allowed: AccessContext = { ...forbidden, permissions: new Set(["admin.access", "research_program.manage"]) };
beforeEach(() => vi.clearAllMocks());
describe("research program service authorization", () => {
  it("denies reads and mutations before creating any Supabase client", async () => {
    const service = new ResearchProgramService();
    await expect(service.list(forbidden, "all")).rejects.toThrow("Недостаточно прав");
    await expect(service.getById(forbidden, "id")).rejects.toThrow("Недостаточно прав");
    await expect(service.options(forbidden)).rejects.toThrow("Недостаточно прав");
    await expect(service.applications(forbidden)).rejects.toThrow("Недостаточно прав");
    await expect(service.save(forbidden, {} as ResearchProgramInput, null)).rejects.toThrow("Недостаточно прав");
    await expect(service.changeState(forbidden, "id", "published")).rejects.toThrow("Недостаточно прав");
    await expect(service.updateApplication(forbidden, "id", "accepted", "note")).rejects.toThrow("Недостаточно прав");
    await expect(service.participation(forbidden, "id")).rejects.toThrow("Недостаточно прав");
    await expect(service.assignMentor(forbidden, "id", null, 1)).rejects.toThrow("Недостаточно прав");
    expect(mocks.privileged).not.toHaveBeenCalled(); expect(mocks.server).not.toHaveBeenCalled();
  });
  it("uses session-scoped decisions without a supplied actor after permission checks", async () => {
    await new ResearchProgramService().updateApplication(allowed, "application", "in_review", "note");
    expect(mocks.server).toHaveBeenCalledOnce();
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith("application", "in_review", "note");
  });
  it("validates participant IDs and versions before creating clients and requires admin access", async () => {
    const service = new ResearchProgramService();
    await expect(service.participation(allowed, "invalid")).rejects.toThrow("invalid_input");
    await expect(service.assignMentor(allowed, "invalid", null, 1)).rejects.toThrow();
    const id = "00000000-0000-4000-a000-000000000001";
    await expect(service.assignMentor(allowed, id, null, 0)).rejects.toThrow();
    await expect(service.participation({ ...allowed, permissions: new Set(["research_program.manage"]) }, id)).rejects.toThrow("Недостаточно прав");
    expect(mocks.server).not.toHaveBeenCalled();
  });
  it("reads and assigns through the session RPCs, without sending a supplied actor", async () => {
    const id = "00000000-0000-4000-a000-000000000001";
    const rpc = vi.fn().mockResolvedValueOnce({ data: { status: "active", mentorId: null, version: 2 }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    mocks.server.mockResolvedValue({ rpc });
    const service = new ResearchProgramService();
    expect(await service.participation(allowed, id)).toEqual({ status: "active", mentorId: null, version: 2 });
    await service.assignMentor(allowed, id, null, 2);
    expect(rpc.mock.calls).toEqual([["get_research_program_participation", { p_application: id }], ["assign_research_program_mentor", { p_application: id, p_mentor: null, p_version: 2 }]]);
    expect(mocks.privileged).not.toHaveBeenCalled();
  });
});
