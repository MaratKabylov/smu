import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  permissionCodes,
  roleCodes,
  type AccessContext,
  type PermissionCode,
  type RoleCode,
} from "@/types/domain/auth";

const knownRoles = new Set<string>(roleCodes);
const knownPermissions = new Set<string>(permissionCodes);

type IdRow = { role_id: string };
type RoleRow = { id: string; code: string };
type PermissionAssignmentRow = { permission_id: string };
type PermissionRow = { code: string };

export class AccessRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getForUser(userId: string): Promise<AccessContext> {
    const { data: assignments, error: assignmentsError } = await this.client
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId);

    if (assignmentsError) throw assignmentsError;

    const roleIds = ((assignments ?? []) as IdRow[]).map(
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
      (permissionAssignments.data ?? []) as PermissionAssignmentRow[]
    ).map((assignment) => assignment.permission_id);

    const permissions = new Set<PermissionCode>();

    if (permissionIds.length > 0) {
      const { data: permissionRows, error: permissionError } = await this.client
        .from("permissions")
        .select("code")
        .in("id", permissionIds);

      if (permissionError) throw permissionError;

      for (const row of (permissionRows ?? []) as PermissionRow[]) {
        if (knownPermissions.has(row.code)) {
          permissions.add(row.code as PermissionCode);
        }
      }
    }

    const roles = new Set<RoleCode>();
    for (const row of (roleRows ?? []) as RoleRow[]) {
      if (knownRoles.has(row.code)) roles.add(row.code as RoleCode);
    }

    return { userId, roles, permissions };
  }
}
