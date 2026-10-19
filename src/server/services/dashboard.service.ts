import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { filterDashboard } from "@/lib/dashboard";
import { DashboardRepository } from "@/server/repositories/dashboard.repository";
import type { AccessContext } from "@/types/domain/auth";
export class DashboardService {
  async read(access: AccessContext) {
    if (!access.permissions.has("admin.access")) throw new Error("forbidden");
    return filterDashboard(await new DashboardRepository(await createServerSupabaseClient()).read(), access);
  }
}
