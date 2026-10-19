import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock("@/server/services/email.service", () => ({ EmailService: class { process = mocks.process; } }));
import { GET, HEAD } from "./route";

const secret = "a-test-secret-with-at-least-32-characters";
const request = (authorization?: string) => new Request("https://example.kz/api/cron/send-email", { headers: authorization ? { authorization } : {} });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", secret); vi.stubEnv("RESEND_API_KEY", "key"); vi.stubEnv("EMAIL_FROM", "SMU <notify@example.org>"); mocks.process.mockResolvedValue({ claimed: 2, sent: 1, retried: 1, failed: 0 }); });
afterEach(() => vi.unstubAllEnvs());

describe("email cron endpoint", () => {
  it("fails closed when email or cron settings are incomplete", async () => {
    for (const key of ["CRON_SECRET", "RESEND_API_KEY", "EMAIL_FROM"] as const) { vi.stubEnv(key, ""); expect((await GET(request(`Bearer ${secret}`))).status).toBe(503); vi.stubEnv(key, key === "CRON_SECRET" ? secret : "configured"); }
    vi.stubEnv("EMAIL_FROM", ""); expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("authenticates, returns aggregates only and disables caching", async () => {
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    const response = await GET(request(`Bearer ${secret}`));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ claimed: 2, sent: 1, retried: 1, failed: 0 });
  });
  it("uses a safe retryable error and never processes HEAD", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {}); mocks.process.mockRejectedValueOnce(new Error("private"));
    expect(await (await GET(request(`Bearer ${secret}`))).json()).toEqual({ error: "email_processing_failed" });
    expect(log).toHaveBeenCalledWith("Email queue processing failed."); log.mockRestore();
    mocks.process.mockClear(); expect(HEAD().status).toBe(405); expect(mocks.process).not.toHaveBeenCalled();
  });
});
