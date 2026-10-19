import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import { dashboardSchema } from "@/lib/dashboard";
export class DashboardRepository {
  constructor(private readonly client: DatabaseClient) {}
  async read() {
    const { data, error } = await this.client.rpc("read_admin_dashboard");
    if (error) throw error;
    return dashboardSchema.parse(data);
  }
}
