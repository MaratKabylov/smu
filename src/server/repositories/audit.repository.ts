import "server-only";

import type { DatabaseClient } from "@/lib/supabase/database";
import { databaseJson } from "@/lib/supabase/database";

type AuditEntry = {
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
};

export class AuditRepository {
  constructor(private readonly client: DatabaseClient) {}

  async create(entry: AuditEntry) {
    const { error } = await this.client.from("audit_logs").insert({
      user_id: entry.userId,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      old_data: databaseJson(entry.oldData ?? null),
      new_data: databaseJson(entry.newData ?? null),
    });

    if (error) throw error;
  }
}
