import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  accessFiltersSchema,
  rolePermissionsInputSchema,
  userRolesInputSchema,
  type AccessFilters,
  type RolePermissionsInput,
  type UserRolesInput,
} from "@/lib/validation/access-management";
import { AccessManagementRepository } from "@/server/repositories/access-management.repository";
import type { AccessContext } from "@/types/domain/auth";

export function canViewAccessManagement(access: AccessContext) {
  return access.permissions.has("admin.access") && access.permissions.has("users.manage");
}

export function canChangeAccessManagement(access: AccessContext) {
  return canViewAccessManagement(access) && access.permissions.has("roles.manage");
}

export class AccessManagementService {
  private assertView(access: AccessContext) {
    if (!canViewAccessManagement(access)) throw new Error("forbidden");
  }

  private assertChange(access: AccessContext) {
    if (!canChangeAccessManagement(access)) throw new Error("forbidden");
  }

  async list(access: AccessContext, filters: AccessFilters) {
    this.assertView(access);
    return new AccessManagementRepository(await createServerSupabaseClient()).list(accessFiltersSchema.parse(filters));
  }

  async setUserRoles(access: AccessContext, input: UserRolesInput) {
    this.assertChange(access);
    return new AccessManagementRepository(await createServerSupabaseClient()).setUserRoles(userRolesInputSchema.parse(input));
  }

  async setRolePermissions(access: AccessContext, input: RolePermissionsInput) {
    this.assertChange(access);
    return new AccessManagementRepository(await createServerSupabaseClient()).setRolePermissions(rolePermissionsInputSchema.parse(input));
  }
}
