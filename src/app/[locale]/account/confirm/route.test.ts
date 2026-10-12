import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock("@/server/services/account.service", () => ({ AccountService: class { confirm = mocks.confirm; } }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example"); mocks.confirm.mockResolvedValue("account"); }); afterEach(() => vi.unstubAllEnvs());
function request(locale = "ru") { return GET(new NextRequest(`https://untrusted-host.example/${locale}/account/confirm?token_hash=secret&type=email&next=https://evil.example`), { params: Promise.resolve({ locale }) }); }
it.each(["ru", "kk", "en"])("removes tokens and redirects %s to a fixed trusted origin", async locale => {
  const result = await request(locale); expect(result.status).toBe(303); expect(result.headers.get("location")).toBe(`https://smu.example/${locale}/account`);
  expect(result.headers.get("cache-control")).toBe("private, no-store"); expect(result.headers.get("referrer-policy")).toBe("no-referrer"); expect(result.headers.get("x-robots-tag")).toBe("noindex, nofollow"); expect(mocks.confirm).toHaveBeenCalledWith({ token_hash: "secret", type: "email" });
});
it("routes recovery to password update and sanitizes expired tokens and exceptions", async () => {
  mocks.confirm.mockResolvedValueOnce("update-password"); expect((await request("kk")).headers.get("location")).toBe("https://smu.example/kk/account/update-password");
  mocks.confirm.mockResolvedValueOnce(null); expect((await request()).headers.get("location")).toBe("https://smu.example/ru/account/login?error=confirm");
  mocks.confirm.mockRejectedValueOnce(new Error("secret")); expect((await request()).headers.get("location")).toBe("https://smu.example/ru/account/login?error=confirm");
});
it("rejects unsupported locales before token exchange", async () => { expect((await request("de")).status).toBe(404); expect(mocks.confirm).not.toHaveBeenCalled(); });
