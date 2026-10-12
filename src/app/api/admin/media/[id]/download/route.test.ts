import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), download: vi.fn() }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/media.service", () => ({ MediaService: class { download = mocks.download; } }));
import { GET } from "./route";
const id = "00000000-0000-4000-a000-000000000081";
const call = (value = id) => GET(new Request("https://smu.kz/api/admin/media/" + value + "/download"), { params: Promise.resolve({ id: value }) });
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { permissions: new Set(["media.view"]) } }); mocks.download.mockResolvedValue("https://storage.test/signed"); });
it("checks Auth/media permission and IDs on every request", async () => {
  expect((await call("invalid")).status).toBe(404); expect(mocks.access).not.toHaveBeenCalled();
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); expect((await call()).status).toBe(401);
  mocks.access.mockResolvedValueOnce({ state: "allowed", access: { permissions: new Set() } }); expect((await call()).status).toBe(403);
  expect(mocks.download).not.toHaveBeenCalled();
});
it("returns a non-cacheable redirect, non-disclosing absence and temporary errors", async () => {
  const response = await call(); expect(response.status).toBe(302); expect(response.headers.get("location")).toBe("https://storage.test/signed");
  mocks.download.mockResolvedValueOnce(null); const missing = await call(); expect(missing.status).toBe(404);
  mocks.download.mockRejectedValueOnce(new Error("Storage error")); const error = await call(); expect(error.status).toBe(503);
  for (const result of [response, missing, error]) { expect(result.headers.get("cache-control")).toBe("private, no-store"); expect(result.headers.get("x-robots-tag")).toBe("noindex, nofollow"); }
});
