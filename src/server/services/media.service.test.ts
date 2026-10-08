import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: vi.fn(), asset: vi.fn(), usages: vi.fn(), update: vi.fn(), remove: vi.fn(), ready: vi.fn(),
  audit: vi.fn(), invalidate: vi.fn(), objects: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.client }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/i18n/revalidation", () => ({ invalidatePublicContent: mocks.invalidate }));
vi.mock("@/server/repositories/media.repository", () => ({ MediaRepository: class {
  getById = mocks.asset; listUsages = mocks.usages; updateMetadata = mocks.update;
  softDelete = mocks.remove; markReady = mocks.ready;
} }));
vi.mock("@/server/repositories/audit.repository", () => ({ AuditRepository: class { create = mocks.audit; } }));
import { MediaService } from "./media.service";
import { mediaMetadataSchema } from "@/lib/validation/media";
import type { AccessContext } from "@/types/domain/auth";
const access: AccessContext = { userId: "owner", roles: new Set(), permissions: new Set(["media.edit", "media.delete", "media.create"]) };
const metadata = mediaMetadataSchema.parse({ altRu: "New alt", altKk: "New alt", altEn: "", captionRu: "", captionKk: "", captionEn: "", copyrightHolder: "", sourceUrl: "" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.asset.mockResolvedValue({ id: "media", status: "uploading", uploadedBy: "owner", storageBucket: "article-media", storagePath: "2026/10/image.png", deletedAt: null });
  mocks.usages.mockResolvedValue([]);
  mocks.objects.mockResolvedValue({ data: [{ name: "image.png", metadata: { size: 1000, mimetype: "image/png" } }], error: null });
  mocks.client.mockReturnValue({ storage: { from: () => ({ list: mocks.objects }) } });
});
describe("media public-cache hooks", () => {
  it("invalidates after metadata commits and before an audit can fail", async () => {
    mocks.audit.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(new MediaService().updateMetadata(access, "media", metadata)).rejects.toThrow("audit unavailable");
    expect(mocks.update).toHaveBeenCalledWith("media", metadata);
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.invalidate.mock.invocationCallOrder[0]);
    expect(mocks.invalidate.mock.invocationCallOrder[0]).toBeLessThan(mocks.audit.mock.invocationCallOrder[0]);
  });
  it("invalidates completed uploads before returning their ID", async () => {
    expect(await new MediaService().completeUpload(access, { mediaAssetId: "media" })).toEqual({ mediaAssetId: "media" });
    expect(mocks.ready).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
  it("invalidates a deleted asset after the commit", async () => {
    await new MediaService().softDelete(access, "media");
    expect(mocks.remove).toHaveBeenCalledWith("media");
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
  it("does not invalidate for denied permissions or absent assets", async () => {
    await expect(new MediaService().updateMetadata({ ...access, permissions: new Set() }, "media", metadata)).rejects.toThrow("Недостаточно прав");
    expect(mocks.client).not.toHaveBeenCalled();
    mocks.asset.mockResolvedValueOnce(null);
    await expect(new MediaService().updateMetadata(access, "media", metadata)).rejects.toThrow("не найден");
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("does not invalidate failed database writes", async () => {
    mocks.update.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(new MediaService().updateMetadata(access, "media", metadata)).rejects.toThrow("database unavailable");
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("leaves the cache intact when deletion is rejected for an in-use asset", async () => {
    mocks.usages.mockResolvedValueOnce([{ id: "usage" }]);
    await expect(new MediaService().softDelete(access, "media")).rejects.toThrow("используется");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
