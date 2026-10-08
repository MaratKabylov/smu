import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), create: vi.fn(), update: vi.fn(), get: vi.fn(), status: vi.fn(), remove: vi.fn(), restore: vi.fn(), verification: vi.fn(), link: vi.fn(), merge: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/scientist.repository", () => ({ ScientistRepository: class {
  create = mocks.create; update = mocks.update; getById = mocks.get; changeStatus = mocks.status; softDelete = mocks.remove;
  restoreDeleted = mocks.restore; changeVerification = mocks.verification; linkAccount = mocks.link; merge = mocks.merge;
}, PublicScientistRepository: class {} }));
import { ScientistService } from "./scientist.service";
import type { AccessContext } from "@/types/domain/auth";
import type { ScientistInput } from "@/lib/validation/scientist";
const manager: AccessContext = { userId: "manager", roles: new Set(), permissions: new Set(["scientists.edit", "scientists.verify"]) };
const denied: AccessContext = { ...manager, permissions: new Set() };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ status: "verified", deletedAt: null }); });
describe("scientist service transactions", () => {
  it("checks session and scientist edit rights and passes deletion timestamps without losing precision", async () => {
    const token = "2026-10-06T12:00:00.123456+00:00";
    for (const permissions of [new Set(), new Set(["admin.access", "scientists.verify"]), new Set(["scientists.edit"])]) {
      await expect(new ScientistService().restoreDeleted({ ...manager, permissions } as AccessContext, "id", token)).rejects.toMatchObject({ code: "forbidden" });
    }
    const allowed: AccessContext = { ...manager, permissions: new Set(["admin.access", "scientists.edit"]) };
    await expect(new ScientistService().restoreDeleted(allowed, "id", "bad")).rejects.toMatchObject({ code: "invalid_input" });
    expect(mocks.client).not.toHaveBeenCalled();
    await new ScientistService().restoreDeleted(allowed, "id", token);
    expect(mocks.restore).toHaveBeenCalledWith("id", token); expect(mocks.status).not.toHaveBeenCalled();
    mocks.restore.mockRejectedValueOnce({ message: "invalid_reference" });
    await expect(new ScientistService().restoreDeleted(allowed, "id", token)).rejects.toMatchObject({ code: "invalid_reference" });
  });
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

describe("scientist extended lifecycle permissions", () => {
  const id = "00000000-0000-4000-a000-000000000010";
  const target = "00000000-0000-4000-a000-000000000011";
  const verification = { status: "rejected" as const, expectedVersion: 4, note: "Missing academic evidence." };
  const account = { email: "scientist@example.kz", expectedVersion: 4 };
  const merge = { sourceId: id, targetId: target, sourceVersion: 4, targetVersion: 6, reason: "Confirmed duplicate identity." };
  it("requires the separate verification, account-management and merge permissions before creating a client", async () => {
    const service = new ScientistService();
    await expect(service.changeVerification(denied,id,verification)).rejects.toMatchObject({code:"forbidden"});
    await expect(service.linkAccount(manager,id,account)).rejects.toMatchObject({code:"forbidden"});
    await expect(service.merge(manager,merge)).rejects.toMatchObject({code:"forbidden"});
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("passes the exact optimistic versions to a session repository and preserves safe RPC failures", async () => {
    const service = new ScientistService();
    await service.changeVerification(manager,id,verification);
    const allowed: AccessContext = { ...manager, permissions: new Set(["scientists.edit","scientists.merge","users.manage"]) };
    await service.linkAccount(allowed,id,account); await service.merge(allowed,merge);
    expect(mocks.verification).toHaveBeenCalledWith(id,"rejected",4,verification.note);
    expect(mocks.link).toHaveBeenCalledWith(id,account.email,4);
    expect(mocks.merge).toHaveBeenCalledWith(id,target,4,6,merge.reason);
    mocks.merge.mockRejectedValueOnce({message:"stale_version"});
    await expect(service.merge(allowed,merge)).rejects.toMatchObject({code:"stale_version"});
  });
  it("rejects incomplete decisions and identical merge targets before writing", async () => {
    await expect(new ScientistService().changeVerification(manager,id,{...verification,note:""})).rejects.toMatchObject({code:"invalid_input"});
    await expect(new ScientistService().merge({...manager,permissions:new Set(["scientists.edit","scientists.merge"])},{...merge,targetId:id})).rejects.toMatchObject({code:"invalid_input"});
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
