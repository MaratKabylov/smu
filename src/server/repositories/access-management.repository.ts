import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import {
  accessCatalogSchema,
  type AccessFilters,
  type RolePermissionsInput,
  type UserRolesInput,
} from "@/lib/validation/access-management";

export class AccessManagementRepository {
  constructor(private readonly client: DatabaseClient) {}

  async list(filters: AccessFilters) {
    const { data, error } = await this.client.rpc("list_access_management", {
      p_page: filters.page,
      p_query: filters.query,
    });
    if (error) throw error;
    return accessCatalogSchema.parse(data);
  }

  async setUserRoles(input: UserRolesInput) {
    const { data, error } = await this.client.rpc("set_user_roles", {
      p_user_id: input.userId,
      p_role_codes: input.roles,
    });
    if (error) throw error;
    return data;
  }

  async setRolePermissions(input: RolePermissionsInput) {
    const { data, error } = await this.client.rpc("set_role_permissions", {
      p_role_code: input.role,
      p_permission_codes: input.permissions,
    });
    if (error) throw error;
    return data;
  }
}
