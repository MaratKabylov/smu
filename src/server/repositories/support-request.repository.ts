import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";
import { supportPageSchema, type SupportInput, type SupportKind, type SupportUpdate } from "@/lib/validation/support-request";
export type SupportFileMetadata = { id: string; path: string; name: string; size: number; mimeType: string };
export class SupportRequestRepository {
  constructor(private readonly client: DatabaseClient) {}
  async submit(id: string, input: SupportInput, files: SupportFileMetadata[], owner: string | null) {
    const { data, error } = await this.client.rpc("submit_support_request", { p_id: id, p_input: input, p_files: files, p_owner: owner });
    if (error) throw error;
    return z.uuid().parse(data);
  }
  async list(kind: SupportKind, manage: boolean, page: number, id: string | null = null, status = "all") {
    const { data, error } = await this.client.rpc("list_support_requests", { p_kind: kind, p_manage: manage, p_page: page, p_id: id, p_status: status });
    if (error) throw error;
    return supportPageSchema.parse(data);
  }
  async update(input: SupportUpdate) {
    const { error } = await this.client.rpc("update_support_request", { p_id: input.id, p_version: input.version, p_status: input.status, p_priority: input.priority, p_assigned_to: input.assignedTo, p_note: input.note });
    if (error) throw error;
  }
  async assignees(kind: SupportKind) {
    const { data, error } = await this.client.rpc("support_request_assignees", { p_kind: kind });
    if (error) throw error;
    return z.array(z.object({ id: z.uuid(), name: z.string() })).parse(data);
  }
  async file(request: string, file: string) {
    const { data, error } = await this.client.rpc("resolve_support_request_file", { p_request: request, p_file: file });
    if (error) throw error;
    return z.object({ path: z.string(), name: z.string() }).nullable().parse(data);
  }
}
