import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/server/services/support-request.service", () => ({ SupportRequestService: class { download = m.download; } }));
import { GET } from "./route";
const id = "00000000-0000-4000-a000-000000000001", fileId = "00000000-0000-4000-a000-000000000002";
const get = (requestId = id) => GET(new Request("https://example.org/api/support/file"), { params: Promise.resolve({ id: requestId, fileId }) });
beforeEach(() => { vi.clearAllMocks(); });
it("forces a private attachment download with a safely encoded Unicode filename", async () => {
  m.download.mockResolvedValue({ blob: new Blob(["%PDF-1.7"]), name: "Исследование';bad.pdf" }); const response = await get();
  expect(response.status).toBe(200); expect(await response.text()).toBe("%PDF-1.7"); expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Content-Disposition")).toContain("attachment;"); expect(response.headers.get("Content-Disposition")).toContain("%27"); expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff"); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it("rejects invalid IDs before service calls", async () => { expect((await get("invalid")).status).toBe(404); expect(m.download).not.toHaveBeenCalled(); });
it("returns identical private not-found responses for inaccessible files and backend errors", async () => {
  m.download.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("SECRET bucket/path"));
  for (let i = 0; i < 2; i++) { const response = await get(); expect(response.status).toBe(404); expect(await response.text()).toBe(""); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); expect(response.headers.get("Referrer-Policy")).toBe("no-referrer"); }
});
