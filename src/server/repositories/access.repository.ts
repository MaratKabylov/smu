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

export class AccessRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getForUser(userId: string): Promise<AccessContext> {
    const { data: assignments, error: assignmentsError } = await this.client
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId);

    if (assignmentsError) throw assignmentsError;

    const roleIds = ((assignments ?? [])).map(
      (assignment) => assignment.role_id,
    );

    if (roleIds.length === 0) {
      return { userId, roles: new Set(), permissions: new Set() };
    }

    const [{ data: roleRows, error: roleError }, permissionAssignments] =
      await Promise.all([
        this.client.from("roles").select("id, code").in("id", roleIds),
        this.client
          .from("role_permissions")
          .select("permission_id")
          .in("role_id", roleIds),
      ]);

    if (roleError) throw roleError;
    if (permissionAssignments.error) throw permissionAssignments.error;

    const permissionIds = (
      (permissionAssignments.data ?? [])
    ).map((assignment) => assignment.permission_id);

    const permissions = new Set<PermissionCode>();

    if (permissionIds.length > 0) {
      const { data: permissionRows, error: permissionError } = await this.client
        .from("permissions")
        .select("code")
        .in("id", permissionIds);

      if (permissionError) throw permissionError;

      for (const row of (permissionRows ?? [])) {
        if (knownPermissions.has(row.code)) {
          permissions.add(row.code as PermissionCode);
        }
      }
    }

    const roles = new Set<RoleCode>();
    for (const row of (roleRows ?? [])) {
      if (knownRoles.has(row.code)) roles.add(row.code as RoleCode);
    }

    return { userId, roles, permissions };
  }
}
