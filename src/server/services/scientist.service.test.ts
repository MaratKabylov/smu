import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), create: vi.fn(), update: vi.fn(), get: vi.fn(), status: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/scientist.repository", () => ({ ScientistRepository: class {
  create = mocks.create; update = mocks.update; getById = mocks.get; changeStatus = mocks.status; softDelete = mocks.remove;
}, PublicScientistRepository: class {} }));
import { ScientistService } from "./scientist.service";
import type { AccessContext } from "@/types/domain/auth";
import type { ScientistInput } from "@/lib/validation/scientist";
const manager: AccessContext = { userId: "manager", roles: new Set(), permissions: new Set(["scientists.edit", "scientists.verify"]) };
const denied: AccessContext = { ...manager, permissions: new Set() };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ status: "verified", deletedAt: null }); });
describe("scientist service transactions", () => {
  it("rejects writes before constructing a client", async () => {
    const service = new ScientistService();
    await expect(service.create(denied, {} as ScientistInput)).rejects.toMatchObject({ code: "forbidden" });
    await expect(service.update(denied, "id", {} as ScientistInput)).rejects.toMatchObject({ code: "forbidden" });
    await expect(service.changeStatus(denied, "id", "verified")).rejects.toMatchObject({ code: "forbidden" });
    await expect(service.softDelete(denied, "id")).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("does not reset verification in a separate transaction", async () => {
    await new ScientistService().update(manager, "id", {} as ScientistInput);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("preserves failure and never performs a follow-up status mutation", async () => {
    mocks.update.mockRejectedValueOnce({ code: "23505" });
    await expect(new ScientistService().update(manager, "id", {} as ScientistInput)).rejects.toMatchObject({ code: "slug_conflict" });
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("rejects repeated verification", async () => {
    await expect(new ScientistService().changeStatus(manager, "id", "verified")).rejects.toMatchObject({ code: "invalid_transition" });
    expect(mocks.status).not.toHaveBeenCalled();
  });
});
