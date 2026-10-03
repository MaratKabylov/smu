import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicSupabaseEnv, getServiceRoleEnv, isSupabaseConfigured } from "./env";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
});

afterEach(() => vi.unstubAllEnvs());

describe("Supabase environment", () => {
  it("configures public and service clients with only a publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

    expect(isSupabaseConfigured()).toBe(true);
    expect(getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(
      "sb_publishable_test",
    );
    expect(getServiceRoleEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    });
  });

  it("falls back to the legacy anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-anon-key");

    expect(isSupabaseConfigured()).toBe(true);
    expect(getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(
      "legacy-anon-key",
    );
  });

  it("prefers the publishable key when both keys are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-anon-key");

    expect(getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(
      "sb_publishable_test",
    );
  });

  it("requires a URL and public key even when a service role key is set", () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getPublicSupabaseEnv()).toThrow();

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getPublicSupabaseEnv()).toThrow();
  });
});
