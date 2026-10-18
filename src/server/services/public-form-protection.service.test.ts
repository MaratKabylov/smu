import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn(), headers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: m.headers }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: m.client }));
import { protectPublicForm } from "./public-form-protection.service";
const secret = "test-secret-with-at-least-32-characters";
const form = () => { const f = new FormData(); f.set("consent", "yes"); f.set("website", ""); return f; };
const digest = (kind: string, value: string) => createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("PUBLIC_FORM_SECRET", secret); vi.stubEnv("PUBLIC_FORM_IP_HEADER", ""); vi.stubEnv("VERCEL", "");
  m.headers.mockResolvedValue(new Headers()); m.client.mockReturnValue({ rpc: m.rpc }); m.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("uses a shared fallback, normalizes email and stores only domain-separated digests", async () => {
  await protectPublicForm(form(), " OWNER@EXAMPLE.ORG ");
  expect(m.rpc).toHaveBeenCalledExactlyOnceWith("consume_public_form_limit", { p_network_key: digest("network", "unknown-network"), p_email_key: digest("email", "owner@example.org") });
  expect(JSON.stringify(m.rpc.mock.calls)).not.toMatch(/owner|example|unknown-network/);
});
it.each(["x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for"])("ignores unconfigured %s even when it looks valid", async header => {
  m.headers.mockResolvedValue(new Headers({ [header]: "192.0.2.50" })); await protectPublicForm(form(), "a@example.org");
  expect(m.rpc.mock.calls[0][1].p_network_key).toBe(digest("network", "unknown-network"));
});
it("uses the Vercel-overwritten address ahead of other forwarding headers", async () => {
  vi.stubEnv("VERCEL", "1"); vi.stubEnv("PUBLIC_FORM_IP_HEADER", "x-real-ip");
  m.headers.mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "192.0.2.50", "x-forwarded-for": "192.0.2.1", "x-real-ip": "192.0.2.2" }));
  await protectPublicForm(form(), "a@example.org"); expect(m.rpc.mock.calls[0][1].p_network_key).toBe(digest("network", "192.0.2.50"));
});
it.each(["", "invalid", "192.0.2.1, 192.0.2.2", "192.0.2.1:443", "192.0.2.1, forged", "fe80::1%eth0"])("uses the fallback for a missing or ambiguous ingress address: %s", async address => {
  vi.stubEnv("PUBLIC_FORM_IP_HEADER", "x-real-ip"); m.headers.mockResolvedValue(new Headers({ "x-real-ip": address }));
  await protectPublicForm(form(), "a@example.org"); expect(m.rpc.mock.calls[0][1].p_network_key).toBe(digest("network", "unknown-network"));
});
it.each(["2001:db8:12:34::1", "2001:0db8:0012:0034:ffff:ffff:ffff:ffff", "2001:db8:12:34:0:0:0:2"])("groups IPv6 privacy addresses by /64: %s", async address => {
  vi.stubEnv("PUBLIC_FORM_IP_HEADER", "x-real-ip"); m.headers.mockResolvedValue(new Headers({ "x-real-ip": address }));
  await protectPublicForm(form(), "a@example.org"); expect(m.rpc.mock.calls[0][1].p_network_key).toBe(digest("network", "2001:db8:12:34::/64"));
});
it.each(["::ffff:192.0.2.1", "0:0:0:0:0:ffff:c000:201"])("groups mapped IPv6 with IPv4: %s", async address => {
  vi.stubEnv("PUBLIC_FORM_IP_HEADER", "x-forwarded-for"); m.headers.mockResolvedValue(new Headers({ "x-forwarded-for": address }));
  await protectPublicForm(form(), "a@example.org"); expect(m.rpc.mock.calls[0][1].p_network_key).toBe(digest("network", "192.0.2.1"));
});
it.each(["missing", "false", "true", "duplicate", "trap", "file-trap", "duplicate-trap"])("rejects forged consent and honeypots before headers or database: %s", async change => {
  const f = form();
  if (change === "missing") f.delete("consent");
  if (["false", "true"].includes(change)) f.set("consent", change);
  if (change === "duplicate") f.append("consent", "yes");
  if (change === "trap") f.set("website", "https://spam.example");
  if (change === "file-trap") f.set("website", new File([], "trap"));
  if (change === "duplicate-trap") f.append("website", "");
  await expect(protectPublicForm(f, "a@example.org")).rejects.toThrow("invalid_input"); expect(m.headers).not.toHaveBeenCalled(); expect(m.client).not.toHaveBeenCalled();
});
it.each(["", "short"])("fails closed without a strong secret: %s", async value => {
  vi.stubEnv("PUBLIC_FORM_SECRET", value); await expect(protectPublicForm(form(), "a@example.org")).rejects.toThrow("protection_unavailable"); expect(m.client).not.toHaveBeenCalled();
});
it("rejects unsupported proxy configuration", async () => {
  vi.stubEnv("PUBLIC_FORM_IP_HEADER", "attacker-header"); await expect(protectPublicForm(form(), "a@example.org")).rejects.toThrow("protection_unavailable"); expect(m.client).not.toHaveBeenCalled();
});
it("returns only safe errors for exhaustion, database failures and malformed replies", async () => {
  m.rpc.mockResolvedValueOnce({ data: false, error: null }); await expect(protectPublicForm(form(), "a@example.org")).rejects.toThrow("rate_limited");
  for (const result of [{ data: true, error: { message: "SECRET" } }, { data: null, error: null }, { data: "true", error: null }]) {
    m.rpc.mockResolvedValueOnce(result); await expect(protectPublicForm(form(), "a@example.org")).rejects.toThrow("protection_unavailable");
  }
});
