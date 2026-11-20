import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AccessRepository } from "./access.repository";
import { permissionCodes } from "@/types/domain/auth";
import type { DatabaseClient } from "@/lib/supabase/database";

function clientFor(role: string, permissions: string[]): DatabaseClient {
  const rows = {
    user_roles: [{ role_id: "role-id" }],
    roles: [{ id: "role-id", code: role }],
    role_permissions: permissions.map((_, index) => ({ permission_id: `permission-${index}` })),
    permissions: permissions.map((code, index) => ({ id: `permission-${index}`, code })),
  };
  return {
    from: (table: keyof typeof rows) => ({
      select: () => ({
        eq: async () => ({ data: rows[table], error: null }),
        in: async () => ({ data: rows[table], error: null }),
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
