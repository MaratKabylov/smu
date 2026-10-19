import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import { requiredFields } from "@/lib/supabase/database";
import { z } from "zod";
import type { DeletedRecordsFilters, PurgeDeletedRecordInput } from "@/lib/validation/deleted-records";
import type { DeletedRecord } from "@/types/domain/deleted-record";

export class DeletedRecordsRepository {
  constructor(private readonly client: DatabaseClient) {}
  async purge(input: PurgeDeletedRecordInput) {
    const { error } = await this.client.rpc("purge_deleted_editorial_record", {
      p_kind: input.kind, p_id: input.id, p_expected_deleted_at: input.expectedDeletedAt,
    });
    if (error) throw error;
  }
  async list(filters: DeletedRecordsFilters) {
    const { data, error } = await this.client.rpc("list_deleted_editorial_records", {
      p_kind: filters.kind, p_query: filters.query, p_page: filters.page,
    });
    if (error) throw error;
    const rows = data ?? [];
    return {
      records: rows.slice(0, 50).map((value): DeletedRecord => {
        const row = requiredFields(value, "id", "status", "deleted_at");
        return {
          id: row.id, kind: z.enum(["article", "scientist"]).parse(row.entity_type), titleRu: row.title_ru, titleKk: row.title_kk,
          status: row.status, deletedAt: row.deleted_at,
        };
      }),
      hasNextPage: rows.length > 50,
    };
  }
}
