import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: vi.fn(), asset: vi.fn(), usages: vi.fn(), update: vi.fn(), remove: vi.fn(), ready: vi.fn(),
  audit: vi.fn(), invalidate: vi.fn(), objects: vi.fn(), download: vi.fn(), store: vi.fn(), storageRemove: vi.fn(), failed: vi.fn(), inspect: vi.fn(), server: vi.fn(), signed: vi.fn(), create: vi.fn(), ticket: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.client }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.server }));
vi.mock("@/lib/media/inspect-file", () => ({ inspectMediaFile: mocks.inspect }));
vi.mock("@/lib/i18n/revalidation", () => ({ invalidatePublicContent: mocks.invalidate }));
vi.mock("@/server/repositories/media.repository", () => ({ MediaRepository: class {
  getById = mocks.asset; listUsages = mocks.usages; updateMetadata = mocks.update;
  softDelete = mocks.remove; finalizeUpload = mocks.ready; markFailed = mocks.failed; createUploading = mocks.create;
} }));
vi.mock("@/server/repositories/audit.repository", () => ({ AuditRepository: class { create = mocks.audit; } }));
import { MediaService } from "./media.service";
import { mediaMetadataSchema } from "@/lib/validation/media";
import type { AccessContext } from "@/types/domain/auth";
const access: AccessContext = { userId: "owner", roles: new Set(), permissions: new Set(["media.edit", "media.delete", "media.create"]) };
const metadata = mediaMetadataSchema.parse({ altRu: "New alt", altKk: "New alt", altEn: "", captionRu: "", captionKk: "", captionEn: "", copyrightHolder: "", sourceUrl: "" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.asset.mockResolvedValue({ id: "media", status: "uploading", uploadedBy: "owner", storageBucket: "article-media", storagePath: "2026/10/image.png", deletedAt: null, fileSize: 1000, mimeType: "image/png", fileName: "image.png" });
  mocks.usages.mockResolvedValue([]);
  mocks.objects.mockResolvedValue({ data: [{ name: "media", metadata: { size: 1000, mimetype: "image/png" } }], error: null });
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(1000)]), error: null });
  mocks.store.mockResolvedValue({ error: null });
  mocks.storageRemove.mockResolvedValue({ error: null });
  mocks.inspect.mockResolvedValue({ width: 32, height: 24 });
  mocks.signed.mockResolvedValue({ data: { signedUrl: "https://storage.test/private" }, error: null });
  mocks.create.mockResolvedValue({ id: "media" }); mocks.ticket.mockResolvedValue({ data: { token: "ticket" }, error: null });
  mocks.client.mockReturnValue({ storage: { from: () => ({ list: mocks.objects, download: mocks.download, upload: mocks.store, remove: mocks.storageRemove, createSignedUrl: mocks.signed, createSignedUploadUrl: mocks.ticket }) } });
});
describe("verified uploads and private downloads", () => {
  it("issues a private staging ticket and validates rules even when called directly", async () => {
    const service = new MediaService();
    expect(await service.createUpload(access, { bucket: "research-files", fileName: "data.csv", fileSize: 42, mimeType: "text/csv" })).toMatchObject({ bucket: "media-staging", path: "owner/media" });
    expect(mocks.ticket).toHaveBeenCalledWith("owner/media", { upsert: false });
    mocks.create.mockClear();
    await expect(service.createUpload(access, { bucket: "article-media", fileName: "data.csv", fileSize: 42, mimeType: "text/csv" })).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("promotes inspected bytes and stores server dimensions instead of client dimensions", async () => {
    await new MediaService().completeUpload(access, { mediaAssetId: "media", width: 999, height: 999 });
    expect(mocks.ready).toHaveBeenCalledWith("media", "owner", { mimeType: "image/png", fileSize: 1000, width: 32, height: 24 });
    expect(mocks.inspect.mock.invocationCallOrder[0]).toBeLessThan(mocks.store.mock.invocationCallOrder[0]);
    expect(mocks.store).toHaveBeenCalledWith("2026/10/image.png", expect.any(Uint8Array), expect.objectContaining({ upsert: false }));
    expect(mocks.storageRemove).toHaveBeenCalledWith(["owner/media"]);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects forged content and removes staging without publishing or invalidating", async () => {
    mocks.inspect.mockRejectedValueOnce(new Error("invalid_file"));
    await expect(new MediaService().completeUpload(access, { mediaAssetId: "media" })).rejects.toThrow("Содержимое");
    expect(mocks.failed).toHaveBeenCalledWith("media"); expect(mocks.store).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.storageRemove).toHaveBeenCalledWith(["owner/media"]);
  });
  it("compensates a failed final transaction, retaining staging for retry", async () => {
    mocks.ready.mockRejectedValueOnce(new Error("audit_failed"));
    await expect(new MediaService().completeUpload(access, { mediaAssetId: "media" })).rejects.toThrow("audit_failed");
    expect(mocks.storageRemove).toHaveBeenCalledExactlyOnceWith(["2026/10/image.png"]);
    expect(mocks.failed).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("rejects mismatched declared size/MIME and actual download size", async () => {
    for (const metadata of [{ size: 999, mimetype: "image/png" }, { size: 1000, mimetype: "image/jpeg" }]) {
      mocks.objects.mockResolvedValueOnce({ data: [{ name: "media", metadata }] });
      await expect(new MediaService().completeUpload(access, { mediaAssetId: "media" })).rejects.toThrow("проверку");
    }
    mocks.download.mockResolvedValueOnce({ data: new Blob(["short"]) });
    await expect(new MediaService().completeUpload(access, { mediaAssetId: "media" })).rejects.toThrow("Содержимое");
    expect(mocks.store).not.toHaveBeenCalled();
  });
  it("denies other upload owners and never removes an existing destination on a write conflict", async () => {
    await expect(new MediaService().completeUpload({ ...access, userId: "other" }, { mediaAssetId: "media" })).rejects.toThrow("другому");
    expect(mocks.download).not.toHaveBeenCalled();
    mocks.store.mockResolvedValueOnce({ error: new Error("already_exists") });
    await expect(new MediaService().completeUpload(access, { mediaAssetId: "media" })).rejects.toThrow("сохранить");
    expect(mocks.storageRemove).not.toHaveBeenCalled();
  });
  it("checks session-visible readiness/deletion before issuing a short download URL", async () => {
    const viewer = { ...access, permissions: new Set(["media.view" as const]) };
    mocks.asset.mockResolvedValueOnce({ status: "ready", storageBucket: "documents", storagePath: "private/doc.pdf", fileName: "doc.pdf" });
    expect(await new MediaService().download(viewer, "media")).toBe("https://storage.test/private");
    expect(mocks.server).toHaveBeenCalledOnce();
    expect(mocks.signed).toHaveBeenCalledWith("private/doc.pdf", 60, { download: "doc.pdf" });
    mocks.signed.mockClear();
    expect(await new MediaService().download(viewer, "media")).toBeNull();
    mocks.asset.mockResolvedValueOnce({ status: "ready", deletedAt: "2026-10-11" });
    expect(await new MediaService().download(viewer, "media")).toBeNull();
    await expect(new MediaService().download(access, "media")).rejects.toThrow("Недостаточно");
    expect(mocks.signed).not.toHaveBeenCalled();
  });
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
