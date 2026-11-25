import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AccessRepository } from "./access.repository";
import { permissionCodes } from "@/types/domain/auth";
import type { DatabaseClient } from "@/lib/supabase/database";

function clientFor(role: string, permissions: string[]): DatabaseClient {
  const rows = [
    {
      roles: {
        code: role,
        role_permissions: permissions.map((code) => ({ permissions: { code } })),
      },
    },
  ];
  return {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: table === "user_roles" ? rows : [], error: null }),
      }),
    }),
  } as unknown as DatabaseClient;
}

describe("access repository", () => {
  it("expands the protected super-admin role to every known permission", async () => {
    const access = await new AccessRepository(clientFor("super_admin", ["admin.access"]))
      .getForUser("user-id");

    expect(access.roles).toEqual(new Set(["super_admin"]));
    expect(access.permissions).toEqual(new Set(permissionCodes));
  });

  it("does not invent permissions for ordinary roles", async () => {
    const access = await new AccessRepository(clientFor("editor", ["admin.access"]))
      .getForUser("user-id");

    expect(access.permissions).toEqual(new Set(["admin.access"]));
  });
});
