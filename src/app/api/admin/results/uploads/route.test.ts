import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), upload: vi.fn() }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/research-output.service", () => ({ canEditOutputs: () => true, ResearchOutputService: class { upload = mocks.upload; } }));
import { POST } from "./route";
import { OUTPUT_FILE_MAX_BYTES } from "@/lib/validation/research-output";
const request = (origin = "https://smu.kz", body: BodyInit | null = null, headers: Record<string, string> = {}) => new NextRequest("https://smu.kz/api/admin/results/uploads", { method: "POST", body, headers: { origin, ...headers } });
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "owner" } }); mocks.upload.mockResolvedValue({ id: "file" }); });
it("checks origin and Auth before reading or storing a body", async () => {
  expect((await POST(request("https://untrusted.kz"))).status).toBe(403); expect(mocks.access).not.toHaveBeenCalled();
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); expect((await POST(request())).status).toBe(401);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("enforces the actual body size even without Content-Length", async () => {
  expect((await POST(request("https://smu.kz", new Uint8Array(OUTPUT_FILE_MAX_BYTES + 65537)))).status).toBe(413);
  expect(mocks.upload).not.toHaveBeenCalled();
  expect((await POST(request("https://smu.kz", null, { "content-length": String(OUTPUT_FILE_MAX_BYTES + 65537) }))).status).toBe(413);
});
it("handles multipart uploads and rejects malformed bodies", async () => {
  const form = new FormData(); form.set("file", new File(["a,b\n1,2"], "data.csv", { type: "text/csv" }));
  expect((await POST(request("https://smu.kz", form))).status).toBe(201);
  expect(mocks.upload).toHaveBeenCalledWith({ userId: "owner" }, expect.objectContaining({ name: "data.csv" }));
  expect((await POST(request("https://smu.kz", "not multipart"))).status).toBe(400);
});
