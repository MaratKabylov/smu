import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), create: vi.fn(), complete: vi.fn() }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/media.service", () => ({ MediaService: class { createUpload = mocks.create; completeUpload = mocks.complete; }, MediaServiceError: class extends Error {} }));
import { POST } from "./route";
import { POST as complete } from "./complete/route";
const request = (body: string, origin = "https://smu.kz", headers: Record<string, string> = {}) => new NextRequest("https://smu.kz/api/admin/media/uploads", { method: "POST", body, headers: { origin, "content-type": "application/json", ...headers } });
const input = { bucket: "research-files", fileName: "data.csv", mimeType: "text/csv", fileSize: 50 * 1024 * 1024 };
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "owner" } }); mocks.create.mockResolvedValue({ bucket: "media-staging", token: "ticket" }); mocks.complete.mockResolvedValue({ mediaAssetId: "media" }); });
it("checks Origin and Auth before preparing or completing tickets", async () => {
  for (const handler of [POST, complete]) {
    expect((await handler(request("{}", "https://untrusted.kz"))).status).toBe(403);
    mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); expect((await handler(request("{}"))).status).toBe(401);
  }
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled();
});
it("allows large Storage uploads without accepting a large request body", async () => {
  expect((await POST(request(JSON.stringify(input)))).status).toBe(201);
  expect(mocks.create).toHaveBeenCalledWith({ userId: "owner" }, input);
  expect((await POST(request(JSON.stringify({ ...input, bucket: "publication-files" })))).status).toBe(400);
});
it("bounds actual JSON bytes with or without Content-Length and rejects malformed bodies", async () => {
  for (const handler of [POST, complete]) {
    expect((await handler(request(" ".repeat(8193)))).status).toBe(400);
    expect((await handler(request("{}", "https://smu.kz", { "content-length": "8193" }))).status).toBe(400);
    expect((await handler(request("not json"))).status).toBe(400);
  }
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled();
});
