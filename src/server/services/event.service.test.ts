import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ server: vi.fn(), privileged: vi.fn(), save: vi.fn(), changeState: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.server }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.privileged }));
vi.mock("@/server/repositories/event.repository", () => ({ EventRepository: class { save = mocks.save; changeState = mocks.changeState; list = mocks.list; } }));
import { EventService } from "./event.service";
import type { AccessContext } from "@/types/domain/auth";
import type { EventInput } from "@/lib/validation/event";
const forbidden: AccessContext = { userId: "user", roles: new Set(["project_manager"]), permissions: new Set(["admin.access", "projects.manage"]) };
const allowed: AccessContext = { ...forbidden, permissions: new Set(["admin.access", "events.manage"]) };
beforeEach(() => vi.clearAllMocks());
describe("event service authorization", () => {
  it("denies reads and writes before creating clients", async () => {
    const service = new EventService();
    await expect(service.list(forbidden, { query: "", status: "all" })).rejects.toThrow("Недостаточно прав");
    await expect(service.getById(forbidden, "id")).rejects.toThrow("Недостаточно прав");
    await expect(service.save(forbidden, {} as EventInput)).rejects.toThrow("Недостаточно прав");
    await expect(service.changeStatus(forbidden, "id", "published")).rejects.toThrow("Недостаточно прав");
    await expect(service.softDelete(forbidden, "id")).rejects.toThrow("Недостаточно прав");
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(mocks.server).not.toHaveBeenCalled();
  });
  it("passes the session actor to privileged mutations", async () => {
    await new EventService().changeStatus(allowed, "event", "cancelled");
    expect(mocks.privileged).toHaveBeenCalledOnce();
    expect(mocks.changeState).toHaveBeenCalledWith("user", "event", "cancelled");
  });
});
