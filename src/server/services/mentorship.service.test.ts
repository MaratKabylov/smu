import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ server: vi.fn(), privileged: vi.fn(), save: vi.fn(), update: vi.fn(), list: vi.fn(), progress: vi.fn(), change: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.server }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.privileged }));
vi.mock("@/server/repositories/mentorship.repository", () => ({ MentorshipRepository: class { save = mocks.save; updateApplication = mocks.update; list = mocks.list; progress = mocks.progress; changeRelation = mocks.change; } }));
import { MentorshipService } from "./mentorship.service";
import type { AccessContext } from "@/types/domain/auth";
import type { MentorshipInput } from "@/lib/validation/mentorship";
const forbidden: AccessContext = { userId: "user", roles: new Set(["project_manager"]), permissions: new Set(["admin.access", "projects.manage"]) };
const allowed: AccessContext = { ...forbidden, permissions: new Set(["admin.access", "mentorship.manage"]) };
beforeEach(() => vi.clearAllMocks());
describe("mentorship service authorization", () => {
  it("denies reads and mutations before creating any Supabase client", async () => {
    const service = new MentorshipService();
    await expect(service.list(forbidden, "all")).rejects.toThrow("Недостаточно прав");
    await expect(service.save(forbidden, {} as MentorshipInput, null)).rejects.toThrow("Недостаточно прав");
    await expect(service.updateApplication(forbidden, "id", "accepted", "note")).rejects.toThrow("Недостаточно прав");
    expect(mocks.privileged).not.toHaveBeenCalled(); expect(mocks.server).not.toHaveBeenCalled();
  });
  it("uses the session for decisions without accepting a caller supplied actor", async () => {
    await new MentorshipService().updateApplication(allowed, "application", "in_review", "note");
    expect(mocks.server).toHaveBeenCalledOnce();
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith("application", "in_review", "note", "mentor");
  });
  it("requires both admin access and management permission for relation operations", async () => {
    const service = new MentorshipService();
    const noAdmin: AccessContext = { ...allowed, permissions: new Set(["mentorship.manage"]) };
    for (const access of [forbidden, noAdmin]) {
      await expect(service.progress(access, "application")).rejects.toThrow("Недостаточно прав");
      await expect(service.changeRelation(access, "application", "paused")).rejects.toThrow("Недостаточно прав");
    }
    expect(mocks.server).not.toHaveBeenCalled();
    await service.progress(allowed, "application"); await service.changeRelation(allowed, "application", "paused");
    expect(mocks.change).toHaveBeenCalledWith("application", "paused"); expect(mocks.privileged).not.toHaveBeenCalled();
  });
});
