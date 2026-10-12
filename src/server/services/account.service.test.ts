import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), client: vi.fn(), user: vi.fn(), login: vi.fn(), signup: vi.fn(), reset: vi.fn(), update: vi.fn(), verify: vi.fn(), logout: vi.fn(), access: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/access.repository", () => ({ AccessRepository: class { getForUser = mocks.access; } }));
import { AccountService } from "./account.service";
const service = new AccountService();
const user = { id: "own-user", email: "own@example.org", email_confirmed_at: "2026-10-12", is_anonymous: false, user_metadata: { display_name: "Own name", role: "super_admin" } };
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ email: user.email, displayName: "Own name", password: "Strong password 42", confirmPassword: "Strong password 42", ...values })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example"); mocks.configured.mockReturnValue(true);
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user, signInWithPassword: mocks.login, signUp: mocks.signup, resetPasswordForEmail: mocks.reset, updateUser: mocks.update, verifyOtp: mocks.verify, signOut: mocks.logout } });
  mocks.user.mockResolvedValue({ data: { user }, error: null }); mocks.access.mockResolvedValue({ userId: user.id, roles: new Set(), permissions: new Set() });
  for (const fn of [mocks.login, mocks.signup, mocks.verify]) fn.mockResolvedValue({ data: { user }, error: null });
  for (const fn of [mocks.reset, mocks.update, mocks.logout]) fn.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("account access", () => {
  it("requires configured Auth and a valid non-anonymous user", async () => {
    mocks.configured.mockReturnValueOnce(false); expect(await service.getAccess()).toEqual({ state: "setup" }); expect(mocks.client).not.toHaveBeenCalled();
    for (const value of [{ data: { user: null }, error: null }, { data: { user }, error: { message: "invalid jwt" } }, { data: { user: { ...user, is_anonymous: true } }, error: null }]) {
      mocks.user.mockResolvedValueOnce(value); expect(await service.getAccess()).toEqual({ state: "unauthenticated" });
    }
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("blocks unconfirmed accounts and reads permissions from the actual account ID", async () => {
    mocks.user.mockResolvedValueOnce({ data: { user: { ...user, email_confirmed_at: null } } }); expect(await service.getAccess()).toEqual({ state: "unconfirmed" });
    expect(await service.getAccess()).toEqual({ state: "allowed", email: user.email, displayName: "Own name", admin: false }); expect(mocks.access).toHaveBeenCalledWith("own-user");
    mocks.access.mockResolvedValueOnce({ permissions: new Set(["admin.access"]) }); expect(await service.getAccess()).toMatchObject({ admin: true });
  });
  it("bounds untrusted names and returns no IDs or metadata", async () => {
    mocks.user.mockResolvedValueOnce({ data: { user: { ...user, user_metadata: { display_name: "x".repeat(300), secret: "hidden" } } } });
    const result = await service.getAccess(); expect(result).toMatchObject({ displayName: "x".repeat(120) }); expect(result).not.toHaveProperty("userId"); expect(result).not.toHaveProperty("secret");
  });
});
describe("account authentication", () => {
  it("rejects invalid forms, passwords, lengths, locales and modes before calling Auth", async () => {
    for (const [mode, values] of [["login", { email: "bad" }], ["register", { displayName: " " }], ["register", { confirmPassword: "different" }], ["update-password", { password: "short", confirmPassword: "short" }], ["recover", { email: "x".repeat(260) + "@example.org" }]] as const) expect(await service.submit("ru", mode, form(values))).toEqual({ message: "invalid" });
    // @ts-expect-error intentionally unsupported runtime mode
    expect(await service.submit("ru", "delete", form())).toEqual({ message: "invalid" });
    // @ts-expect-error intentionally unsupported runtime locale
    expect(await service.submit("de", "register", form())).toEqual({ message: "invalid" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("supports existing short passwords at login and keeps failed credentials generic", async () => {
    expect(await service.submit("kk", "login", form({ password: "old" }))).toEqual({ navigate: true }); expect(mocks.login).toHaveBeenCalledWith({ email: user.email, password: "old" });
    mocks.login.mockResolvedValueOnce({ error: { status: 400, message: "user missing" } }); expect(await service.submit("ru", "login", form())).toEqual({ message: "credentials" });
    mocks.login.mockResolvedValueOnce({ data: { user: { ...user, email_confirmed_at: null } } }); expect(await service.submit("ru", "login", form())).toEqual({ message: "credentials" }); expect(mocks.logout).toHaveBeenCalledWith({ scope: "local" });
  });
  it.each(["ru", "kk", "en"] as const)("registers only display name and sends a fixed %s URL", async locale => {
    const data = form(); data.set("role", "super_admin"); data.set("redirectTo", "https://evil.example");
    expect(await service.submit(locale, "register", data)).toEqual({ message: "sent" });
    expect(mocks.signup).toHaveBeenCalledWith({ email: user.email, password: "Strong password 42", options: { data: { display_name: "Own name" }, emailRedirectTo: `https://smu.example/${locale}/account/confirm` } });
  });
  it("does not disclose an existing signup address or provider errors", async () => {
    mocks.signup.mockResolvedValueOnce({ error: { code: "user_already_exists" } }); expect(await service.submit("ru", "register", form())).toEqual({ message: "sent" });
    mocks.signup.mockResolvedValueOnce({ error: { code: "email_exists" } }); expect(await service.submit("ru", "register", form())).toEqual({ message: "sent" });
    mocks.signup.mockResolvedValueOnce({ error: { message: "private auth error" } }); expect(await service.submit("ru", "register", form())).toEqual({ message: "failed" });
  });
  it("recovers with a fixed URL and reports rate limits and delivery failures", async () => {
    expect(await service.submit("kk", "recover", form())).toEqual({ message: "sent" }); expect(mocks.reset).toHaveBeenCalledWith(user.email, { redirectTo: "https://smu.example/kk/account/confirm" });
    mocks.reset.mockResolvedValueOnce({ error: { status: 429 } }); expect(await service.submit("ru", "recover", form())).toEqual({ message: "rate" });
    mocks.reset.mockResolvedValueOnce({ error: { status: 503 } }); expect(await service.submit("ru", "recover", form())).toEqual({ message: "failed" });
  });
  it("rechecks verified session in password changes independently of page access", async () => {
    for (const value of [null, { ...user, is_anonymous: true }, { ...user, email_confirmed_at: null }]) {
      mocks.user.mockResolvedValueOnce({ data: { user: value } }); expect(await service.submit("ru", "update-password", form())).toEqual({ message: "session" });
    }
    expect(mocks.update).not.toHaveBeenCalled(); expect(await service.submit("ru", "update-password", form())).toEqual({ message: "saved" }); expect(mocks.update).toHaveBeenCalledWith({ password: "Strong password 42" });
    mocks.update.mockResolvedValueOnce({ error: { code: "weak_password" } }); expect(await service.submit("ru", "update-password", form())).toEqual({ message: "failed" });
  });
  it("does not consume malformed or unrelated confirmation tokens", async () => {
    for (const value of [{ token_hash: "bad", type: "email" }, { token_hash: "a".repeat(64), type: "invite" }, { code: "pkce", type: "recovery" }]) expect(await service.confirm(value)).toBeNull(); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("verifies signup/recovery tokens and fails closed for expired or unconfirmed users", async () => {
    for (const type of ["email", "signup", "recovery"]) expect(await service.confirm({ token_hash: "a".repeat(64), type })).toBe(type === "recovery" ? "update-password" : "account");
    mocks.verify.mockResolvedValueOnce({ error: { message: "expired" }, data: { user: null } }); expect(await service.confirm({ token_hash: "a".repeat(64), type: "email" })).toBeNull();
    mocks.verify.mockResolvedValueOnce({ data: { user: { ...user, email_confirmed_at: null } } }); expect(await service.confirm({ token_hash: "a".repeat(64), type: "email" })).toBeNull();
  });
  it("logs out this session and reports provider failures", async () => {
    expect(await service.logout()).toEqual({}); expect(mocks.logout).toHaveBeenCalledWith({ scope: "local" });
    mocks.logout.mockResolvedValueOnce({ error: { status: 503 } }); expect(await service.logout()).toEqual({ message: "failed" });
  });
});
