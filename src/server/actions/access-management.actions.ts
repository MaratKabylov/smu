"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { databaseErrorCode } from "@/lib/security/database-error";
import {
  accessFiltersSchema,
  accessManagementPath,
  rolePermissionsInputSchema,
  userRolesInputSchema,
} from "@/lib/validation/access-management";
import { getAdminAccess } from "@/server/services/access.service";
import { AccessManagementService } from "@/server/services/access-management.service";

async function requireAccess() {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect("/admin");
  return result.access;
}

function destination(form: FormData, result: { error?: string; saved?: string }) {
  const parsed = accessFiltersSchema.safeParse({ query: form.get("query"), page: form.get("page") });
  const params = new URLSearchParams();
  if (parsed.success) {
    if (parsed.data.query) params.set("q", parsed.data.query);
    if (parsed.data.page > 1) params.set("page", String(parsed.data.page));
  }
  if (result.error) params.set("error", result.error);
  if (result.saved) params.set("saved", result.saved);
  const query = params.toString();
  return `${accessManagementPath}${query ? `?${query}` : ""}`;
}

export async function updateUserRoles(form: FormData) {
  const access = await requireAccess();
  const parsed = userRolesInputSchema.safeParse({
    userId: form.get("userId"),
    roles: form.getAll("roles"),
  });
  if (!parsed.success) redirect(destination(form, { error: "validation" }));
  try {
    await new AccessManagementService().setUserRoles(access, parsed.data);
  } catch (error) {
    redirect(destination(form, { error: databaseErrorCode(error) ?? "action_failed" }));
  }
  revalidatePath(accessManagementPath);
  redirect(destination(form, { saved: "roles" }));
}

export async function updateRolePermissions(form: FormData) {
  const access = await requireAccess();
  const parsed = rolePermissionsInputSchema.safeParse({
    role: form.get("role"),
    permissions: form.getAll("permissions"),
  });
  if (!parsed.success) redirect(destination(form, { error: "validation" }));
  try {
    await new AccessManagementService().setRolePermissions(access, parsed.data);
  } catch (error) {
    redirect(destination(form, { error: databaseErrorCode(error) ?? "action_failed" }));
  }
  revalidatePath(accessManagementPath);
  redirect(destination(form, { saved: "permissions" }));
}
