import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import { requiredFields } from "@/lib/supabase/database";
import type { AuditFilters } from "@/lib/validation/audit";

export class AuditRecordsRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list(filters: AuditFilters) {
    const { data, error } = await this.client.rpc("list_audit_records", {
      p_entity_type: filters.entityType, p_action: filters.action,
      p_actor: filters.actor || null, p_entity_id: filters.entityId || null,
      p_from: filters.from || null, p_until: filters.until || null, p_page: filters.page,
    });
    if (error) throw error;
    const rows = data ?? [];
    return {
      records: rows.slice(0, 50).map(row => requiredFields(row, "id", "entity_type", "action", "created_at")),
      hasNextPage: rows.length > 50,
    };
  }
}
