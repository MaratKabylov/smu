import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ publish: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("@/server/services/article-scheduling.service", () => ({
  ArticleSchedulingService: class { publishDue = mocks.publish; },
}));
import { GET, HEAD } from "./route";

const secret = "a-test-secret-with-at-least-32-characters";
const request = (authorization?: string) => new Request("https://example.kz/api/cron/publish-scheduled", {
  headers: authorization ? { authorization } : {},
});
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", secret);
  mocks.publish.mockResolvedValue({ published: 2, rejected: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("scheduled publishing endpoint", () => {
  it("fails closed without a strong configured secret", async () => {
    for (const value of ["", "short"]) {
      vi.stubEnv("CRON_SECRET", value);
      expect((await GET(request(`Bearer ${value}`))).status).toBe(503);
    }
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("rejects missing, incorrect and malformed credentials before accessing the service", async () => {
    for (const value of [undefined, "Bearer wrong", secret, `bearer ${secret}`, `Bearer ${secret}suffix`]) {
      const response = await GET(request(value));
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.publish).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("returns only aggregate counts and refreshes both public and editorial pages", async () => {
    const response = await GET(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ published: 2, rejected: 0 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    for (const path of ["/admin/content/articles", "/journal", "/scientists", "/projects", "/research", "/events", "/publications"]) {
      for (const target of path.startsWith("/admin") ? [path] : [`/ru${path}`, `/kk${path}`]) expect(mocks.invalidate).toHaveBeenCalledWith(target, "layout");
    }
  });
  it("invalidates even an empty retry after an earlier commit with a lost HTTP response", async () => {
    mocks.publish.mockResolvedValueOnce({ published: 0, rejected: 0 });
    expect(await (await GET(request(`Bearer ${secret}`))).json()).toEqual({ published: 0, rejected: 0 });
    for (const locale of ["ru", "kk"]) expect(mocks.invalidate).toHaveBeenCalledWith(`/${locale}/journal`, "layout");
  });
  it("returns a retryable error without exposing database details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.publish.mockRejectedValueOnce(new Error("private database detail"));
      const response = await GET(request(`Bearer ${secret}`));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "publishing_failed" });
      expect(log).toHaveBeenCalledWith("Scheduled article publishing failed.");
      expect(mocks.invalidate).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("does not allow a HEAD health check to execute the publishing GET", () => {
    expect(HEAD().status).toBe(405); expect(HEAD().headers.get("allow")).toBe("GET");
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
