import "server-only";

import type { DatabaseClient } from "@/lib/supabase/database";
import {
  permissionCodes,
  roleCodes,
  type AccessContext,
  type PermissionCode,
  type RoleCode,
} from "@/types/domain/auth";

const knownRoles = new Set<string>(roleCodes);
const knownPermissions = new Set<string>(permissionCodes);

type EmbeddedPermission = { code: string } | null;
type EmbeddedRolePermission = { permissions: EmbeddedPermission | EmbeddedPermission[] };
type EmbeddedRole = { code: string; role_permissions: EmbeddedRolePermission[] | null } | null;

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export class AccessRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getForUser(userId: string): Promise<AccessContext> {
    const { data: assignments, error: assignmentsError } = await this.client
      .from("user_roles")
      .select("roles(code, role_permissions(permissions(code)))")
      .eq("user_id", userId);

    if (assignmentsError) throw assignmentsError;

    const roles = new Set<RoleCode>();
    const permissions = new Set<PermissionCode>();

    for (const assignment of assignments ?? []) {
      for (const role of asArray(assignment.roles as EmbeddedRole | EmbeddedRole[])) {
        if (!role) continue;
        if (knownRoles.has(role.code)) roles.add(role.code as RoleCode);
        for (const rolePermission of role.role_permissions ?? []) {
          for (const permission of asArray(rolePermission.permissions)) {
            if (permission && knownPermissions.has(permission.code)) {
              permissions.add(permission.code as PermissionCode);
            }
          }
        }
      }
    }

    // super_admin is a protected platform role and is defined as having every
    // application permission. Keep that invariant at the authorization
    // boundary even if an upgraded database has stale role_permissions rows.
    if (roles.has("super_admin")) {
      for (const permission of permissionCodes) permissions.add(permission);
    }

    return { userId, roles, permissions };
  }
}
