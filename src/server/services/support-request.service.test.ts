import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ configured: vi.fn(), session: vi.fn(), trusted: vi.fn(), auth: vi.fn(), rpc: vi.fn(), trustedRpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn(), bucket: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: m.configured }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: m.session }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: m.trusted }));
import { SupportRequestService } from "./support-request.service";
const id = "00000000-0000-4000-a000-000000000001", fileId = "00000000-0000-4000-a000-000000000002";
const user = { id, email: "verified@example.org", email_confirmed_at: "2026-10-17", is_anonymous: false };
const input = { kind: "it_request", locale: "ru", title: "Research system", description: "A description of the scientific IT request.", contactName: "A Scientist", email: "typed@example.org", organization: "", consent: true, details: { currentProcess: "Manual", desiredSolution: "Automation", dataDescription: "Research data" } };
const file = () => new File(["%PDF-1.7\nPRIVATE DATA"], "research.pdf", { type: "application/pdf" });
const service = new SupportRequestService();
beforeEach(() => {
  vi.clearAllMocks(); m.configured.mockReturnValue(true); m.auth.mockResolvedValue({ data: { user }, error: null });
  m.session.mockResolvedValue({ auth: { getUser: m.auth }, rpc: m.rpc }); m.trusted.mockReturnValue({ rpc: m.trustedRpc, storage: { from: m.bucket } });
  m.bucket.mockReturnValue({ upload: m.upload, remove: m.remove, download: m.download }); m.upload.mockResolvedValue({ error: null }); m.remove.mockResolvedValue({ error: null });
  m.trustedRpc.mockResolvedValue({ data: id, error: null }); m.rpc.mockResolvedValue({ data: { total: 0, page: 1, pageSize: 20, items: [] }, error: null });
});
it("derives ownership and contact email from live verified Auth and never uses a supplied actor", async () => {
  expect(await service.submit({ ...input, owner_id: "FORGED" }, [file()])).toBe(id);
  expect(m.trustedRpc).toHaveBeenCalledWith("submit_support_request", { p_id: expect.any(String), p_input: { ...input, email: user.email }, p_files: [{ id: expect.any(String), path: expect.any(String), name: "research.pdf", size: 21, mimeType: "application/pdf" }], p_owner: user.id });
  expect(m.bucket).toHaveBeenCalledWith("support-request-files"); expect(m.upload).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/), expect.any(Uint8Array), { contentType: "application/pdf", upsert: false });
  expect(m.rpc).not.toHaveBeenCalled();
});
it("accepts a genuine missing guest session without claiming an account by email", async () => {
  m.auth.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
  await service.submit(input, []); expect(m.trustedRpc.mock.calls[0][1]).toMatchObject({ p_owner: null, p_input: { email: "typed@example.org" } });
});
it("does not turn failed, unconfirmed or anonymous sessions into guest submissions", async () => {
  for (const result of [{ data: { user: null }, error: { name: "NetworkError" } }, { data: { user: { ...user, email_confirmed_at: null } }, error: null }, { data: { user: { ...user, is_anonymous: true } }, error: null }]) {
    m.auth.mockResolvedValue(result); await expect(service.submit(input, [file()])).rejects.toThrow("session");
  }
  expect(m.upload).not.toHaveBeenCalled(); expect(m.trustedRpc).not.toHaveBeenCalled();
});
it("validates all files before any storage operation", async () => {
  for (const files of [[file(), file(), file(), file()], [file(), new File(["<html>fake</html>"], "fake.pdf", { type: "application/pdf" })], [new File([], "empty.pdf", { type: "application/pdf" })]]) await expect(service.submit(input, files)).rejects.toThrow("invalid_file");
  expect(m.upload).not.toHaveBeenCalled(); expect(m.trustedRpc).not.toHaveBeenCalled();
});
it("cleans up stored files when metadata or audit fails", async () => {
  m.trustedRpc.mockResolvedValueOnce({ data: null, error: { message: "audit_failed SECRET" } });
  await expect(service.submit(input, [file(), file()])).rejects.toEqual({ message: "audit_failed SECRET" });
  expect(m.remove).toHaveBeenCalledWith(m.upload.mock.calls.map(call => call[0]));
});
it("cleans up earlier files if a later upload fails and never submits partial metadata", async () => {
  m.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error("upload_failed") });
  await expect(service.submit(input, [file(), file()])).rejects.toThrow("upload_failed");
  expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0][0]]); expect(m.trustedRpc).not.toHaveBeenCalled();
});
it("uses session RPCs for both projections, assignments and versioned decisions", async () => {
  await service.list("it_request", true, 2, id, "in_review");
  expect(m.rpc).toHaveBeenCalledWith("list_support_requests", { p_kind: "it_request", p_manage: true, p_page: 2, p_id: id, p_status: "in_review" });
  m.rpc.mockResolvedValueOnce({ data: [], error: null }); await service.assignees("it_request");
  await service.update({ id, version: 2, status: "in_progress", priority: "high", assignedTo: null, note: "Internal" });
  expect(m.rpc).toHaveBeenLastCalledWith("update_support_request", { p_id: id, p_version: 2, p_status: "in_progress", p_priority: "high", p_assigned_to: null, p_note: "Internal" }); expect(m.trusted).not.toHaveBeenCalled();
});
it("authorizes every download before any service-role Storage read", async () => {
  m.rpc.mockResolvedValueOnce({ data: null, error: null }); expect(await service.download(id, fileId)).toBeNull(); expect(m.trusted).not.toHaveBeenCalled();
  m.rpc.mockResolvedValueOnce({ data: { path: `${id}/${fileId}`, name: "private.pdf" }, error: null }); const blob = new Blob(["%PDF-private"]); m.download.mockResolvedValue({ data: blob, error: null });
  expect(await service.download(id, fileId)).toEqual({ blob, name: "private.pdf" });
  expect(m.rpc).toHaveBeenCalledWith("resolve_support_request_file", { p_request: id, p_file: fileId }); expect(m.download).toHaveBeenCalledWith(`${id}/${fileId}`);
});
it("refuses all private operations without a verified session", async () => {
  m.auth.mockResolvedValue({ data: { user: null }, error: null });
  await expect(service.list("it_request")).rejects.toThrow("session"); await expect(service.assignees("it_request")).rejects.toThrow("session"); await expect(service.download(id, fileId)).rejects.toThrow("session");
  await expect(service.update({ id, version: 1, status: "new", priority: "normal", assignedTo: null, note: "" })).rejects.toThrow("session"); expect(m.trusted).not.toHaveBeenCalled();
});
