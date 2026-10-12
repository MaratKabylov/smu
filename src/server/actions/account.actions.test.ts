import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ submit: vi.fn(), logout: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); }, notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/server/services/account.service", () => ({ AccountService: class { submit = mocks.submit; logout = mocks.logout; } }));
import { logoutAccount, submitAccountForm } from "./account.actions";
beforeEach(() => { vi.clearAllMocks(); mocks.submit.mockResolvedValue({ message: "sent" }); mocks.logout.mockResolvedValue({}); });
it("keeps sign-in redirect outside the provider error catch", async () => { mocks.submit.mockResolvedValue({ navigate: true }); await expect(submitAccountForm("kk", "login", {}, new FormData())).rejects.toThrow("redirect:/kk/account"); });
it("returns safe notices and sanitizes exceptions", async () => {
  expect(await submitAccountForm("en", "register", {}, new FormData())).toEqual({ message: "sent" }); mocks.submit.mockRejectedValueOnce(new Error("secret")); expect(await submitAccountForm("ru", "login", {}, new FormData())).toEqual({ message: "failed" });
});
it("rejects unsupported locales before Auth", async () => {
  await expect(submitAccountForm("de", "login", {}, new FormData())).rejects.toThrow("not_found"); await expect(logoutAccount("de")).rejects.toThrow("not_found"); expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.logout).not.toHaveBeenCalled();
});
it("redirects logout only after successful provider revocation", async () => {
  await expect(logoutAccount("ru")).rejects.toThrow("redirect:/ru/account/login"); mocks.logout.mockResolvedValueOnce({ message: "failed" }); await expect(logoutAccount("kk")).rejects.toThrow("redirect:/kk/account?error=logout"); mocks.logout.mockRejectedValueOnce(new Error("offline")); await expect(logoutAccount("en")).rejects.toThrow("redirect:/en/account?error=logout");
});
