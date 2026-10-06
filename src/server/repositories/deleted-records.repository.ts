import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeletedRecordsFilters } from "@/lib/validation/deleted-records";
import type { DeletedRecord } from "@/types/domain/deleted-record";

type Row = {
  id: string; entity_type: DeletedRecord["kind"]; title_ru: string | null;
  title_kk: string | null; status: string; deleted_at: string;
};
export class DeletedRecordsRepository {
  constructor(private readonly client: SupabaseClient) {}
  async list(filters: DeletedRecordsFilters) {
    const { data, error } = await this.client.rpc("list_deleted_editorial_records", {
      p_kind: filters.kind, p_query: filters.query, p_page: filters.page,
    });
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    return {
      records: rows.slice(0, 50).map((row): DeletedRecord => ({
        id: row.id, kind: row.entity_type, titleRu: row.title_ru, titleKk: row.title_kk,
        status: row.status, deletedAt: row.deleted_at,
      })),
      hasNextPage: rows.length > 50,
    };
  }
}
