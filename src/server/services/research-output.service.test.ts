import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), resolve: vi.fn(), listPublic: vi.fn(), upload: vi.fn(), insert: vi.fn(), remove: vi.fn(), signed: vi.fn(),
  server: vi.fn(), publicClient: vi.fn(), service: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.server }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.publicClient }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.service }));
vi.mock("@/server/repositories/research-output.repository", () => ({ ResearchOutputRepository: class { save = mocks.save; resolveFile = mocks.resolve; publicByWork = mocks.listPublic; } }));
import { ResearchOutputService } from "./research-output.service";
import type { AccessContext } from "@/types/domain/auth";
const id = "00000000-0000-4000-a000-000000000010";
const owner: AccessContext = { userId: id, roles: new Set(["author"]), permissions: new Set(["outputs.create"]) };
const translation = { title: "Research results", description: "Meaningful description of research results" };
const input = { kind: "dataset" as const, status: "draft" as const, versionLabel: "v1", license: "CC BY", changeNote: "", externalUrl: "", workIds: [id], files: [], ru: translation, kk: translation };
beforeEach(() => {
  vi.clearAllMocks(); mocks.server.mockResolvedValue({ session: true }); mocks.publicClient.mockReturnValue({ anonymous: true });
  mocks.service.mockReturnValue({ storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.signed }) }, from: () => ({ insert: mocks.insert }) });
  mocks.upload.mockResolvedValue({ error: null }); mocks.insert.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null });
});
it("rejects missing permissions and versions before calling a database mutation", async () => {
  const service = new ResearchOutputService();
  await expect(service.save({ ...owner, permissions: new Set() }, null, input)).rejects.toThrow("forbidden");
  await expect(service.save(owner, id, input)).rejects.toThrow("stale_version");
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.service).not.toHaveBeenCalled();
  await service.save(owner, id, { ...input, expectedVersion: 1 });
  expect(mocks.server).toHaveBeenCalled(); expect(mocks.save).toHaveBeenCalledWith(id, expect.objectContaining({ expectedVersion: 1 }));
});
it("reads public outputs anonymously and resolves downloads through a fresh session", async () => {
  const service = new ResearchOutputService();
  await service.publicByWork("kk", id);
  expect(mocks.publicClient).toHaveBeenCalled(); expect(mocks.listPublic).toHaveBeenCalledWith("kk", id);
  mocks.resolve.mockResolvedValue(null); expect(await service.download(id, 1, id)).toBeNull();
  expect(mocks.service).not.toHaveBeenCalled();
  mocks.resolve.mockResolvedValue({ path: "owner/path", name: "data.csv" }); mocks.signed.mockResolvedValue({ data: { signedUrl: "signed" }, error: null });
  expect(await service.download(id, 1, id)).toBe("signed");
  expect(mocks.signed).toHaveBeenCalledWith("owner/path", 60, { download: "data.csv" });
});
it("uploads validated bytes to an immutable owner path and cleans up if metadata insertion fails", async () => {
  const service = new ResearchOutputService(); const file = new File(["a,b\n1,2"], "data.csv", { type: "text/csv" });
  const uploaded = await service.upload(owner, file);
  expect(uploaded.name).toBe("data.csv");
  expect(mocks.upload).toHaveBeenCalledWith(`${id}/${uploaded.id}`, expect.any(Uint8Array), { contentType: "text/csv", upsert: false });
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ uploaded_by: id, ready: true, file_size: file.size, mime_type: "text/csv" }));
  mocks.insert.mockResolvedValueOnce({ error: new Error("Database offline") });
  await expect(service.upload(owner, file)).rejects.toThrow("Database offline"); expect(mocks.remove).toHaveBeenCalledWith([expect.stringContaining(id + "/")]);
});
it("rejects spoofed file content and permissions before touching Storage", async () => {
  const service = new ResearchOutputService();
  await expect(service.upload(owner, new File(["fake"], "report.pdf", { type: "application/pdf" }))).rejects.toThrow("invalid_file");
  await expect(service.upload({ ...owner, permissions: new Set() }, new File(["a,b"], "data.csv", { type: "text/csv" }))).rejects.toThrow("forbidden");
  expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
});
