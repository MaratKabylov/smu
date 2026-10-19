import { z } from "zod";
import { permissionCodes, roleCodes } from "@/types/domain/auth";

export const accessManagementPath = "/admin/system/access";
const roleCodeSchema = z.enum(roleCodes);
const permissionCodeSchema = z.enum(permissionCodes);
const distinct = <T>(values: T[]) => new Set(values).size === values.length;

export const accessFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export const accessCatalogSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.literal(30),
  total: z.number().int().nonnegative(),
  superAdminCount: z.number().int().nonnegative(),
  users: z.array(z.object({
    id: z.uuid(),
    displayName: z.string().max(500).nullable(),
    email: z.string().max(500).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    roles: z.array(roleCodeSchema).refine(distinct),
  })),
  roles: z.array(z.object({
    code: roleCodeSchema,
    name: z.string().min(1).max(200),
    protected: z.boolean(),
    permissions: z.array(permissionCodeSchema).refine(distinct),
  })),
  permissions: z.array(z.object({
    code: permissionCodeSchema,
    name: z.string().min(1).max(300),
  })),
});

export const userRolesInputSchema = z.object({
  userId: z.uuid(),
  roles: z.array(roleCodeSchema).min(1).max(roleCodes.length)
    .refine(distinct).refine(roles => roles.includes("user")),
});

export const rolePermissionsInputSchema = z.object({
  role: roleCodeSchema.exclude(["user", "admin", "super_admin"]),
  permissions: z.array(permissionCodeSchema).max(permissionCodes.length).refine(distinct),
});

export type AccessFilters = z.infer<typeof accessFiltersSchema>;
export type AccessCatalog = z.infer<typeof accessCatalogSchema>;
export type UserRolesInput = z.infer<typeof userRolesInputSchema>;
export type RolePermissionsInput = z.infer<typeof rolePermissionsInputSchema>;
