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
    expect(mocks.privileged).not.toHaveBeenCalled(); expect(mocks.server).not.toHaveBeenCalled();
  });
  it("passes the authenticated actor to privileged writes after permission checks", async () => {
    await new ResearchProgramService().updateApplication(allowed, "application", "in_review", "note");
    expect(mocks.privileged).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith("user", "application", "in_review", "note");
  });
});
