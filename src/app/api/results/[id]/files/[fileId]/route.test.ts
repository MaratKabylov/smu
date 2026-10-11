import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/server/services/research-output.service", () => ({ ResearchOutputService: class { download = mocks.download; } }));
import { GET } from "./route";
const id = "00000000-0000-4000-a000-000000000010";
const params = Promise.resolve({ id, fileId: id });
beforeEach(() => vi.clearAllMocks());
it("redirects only after access resolution, with no-store and noindex headers", async () => {
  mocks.download.mockResolvedValue("https://storage.example/signed");
  const result = await GET(new Request("https://smu.kz/api/results/file?version=2"), { params });
  expect(mocks.download).toHaveBeenCalledWith(id, 2, id); expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe("https://storage.example/signed");
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(result.headers.get("x-robots-tag")).toBe("noindex, nofollow");
});
it("conceals inaccessible files and rejects invalid parameters without reaching Storage", async () => {
  for (const version of ["", "0", "-1", "1.5", "NaN"]) expect((await GET(new Request("https://smu.kz/api/results/file?version=" + version), { params })).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
  mocks.download.mockResolvedValue(null);
  expect((await GET(new Request("https://smu.kz/api/results/file?version=1"), { params })).status).toBe(404);
});
it("returns a non-cacheable failure if storage cannot issue a signed URL", async () => {
  mocks.download.mockRejectedValue(new Error("Storage"));
  const result = await GET(new Request("https://smu.kz/api/results/file?version=1"), { params });
  expect(result.status).toBe(503); expect(result.headers.get("cache-control")).toContain("no-store");
});
