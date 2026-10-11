import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/env";
import { hasPermission } from "@/lib/permissions/permissions";
import { OUTPUT_FILE_MAX_BYTES, validateOutputFile, outputFileMimeSchema, researchOutputInputSchema, type ResearchOutputInput } from "@/lib/validation/research-output";
import { ResearchOutputRepository } from "@/server/repositories/research-output.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { ArticleLocale } from "@/types/domain/article";

export function canEditOutputs(access: AccessContext) {
  return hasPermission(access, "outputs.create") || hasPermission(access, "outputs.manage");
}
function assertAccess(access: AccessContext) {
  if (!canEditOutputs(access)) throw new Error("forbidden");
}
export class ResearchOutputService {
  async list(access: AccessContext) {
    assertAccess(access);
    return new ResearchOutputRepository(await createServerSupabaseClient()).list();
  }
  async get(access: AccessContext, id: string) {
    assertAccess(access);
    return new ResearchOutputRepository(await createServerSupabaseClient()).get(id);
  }
  async uploads(access: AccessContext, ids: string[] = []) {
    assertAccess(access);
    return new ResearchOutputRepository(await createServerSupabaseClient()).uploads(access.userId, ids);
  }
  async workOptions(access: AccessContext, query = "", ids: string[] | null = null) {
    assertAccess(access);
    return new ResearchOutputRepository(await createServerSupabaseClient()).workOptions(query, ids);
  }
  async save(access: AccessContext, id: string | null, input: ResearchOutputInput) {
    assertAccess(access);
    const validated = researchOutputInputSchema.parse(input);
    if (id && !validated.expectedVersion) throw new Error("stale_version");
    // The session RPC repeats owner, permissions, references and version checks.
    return new ResearchOutputRepository(await createServerSupabaseClient()).save(id, validated);
  }
  async publicByWork(locale: ArticleLocale, workId: string) {
    if (!isSupabaseConfigured()) return [];
    return new ResearchOutputRepository(createPublicSupabaseClient()).publicByWork(locale, workId);
  }
  async upload(access: AccessContext, file: File) {
    assertAccess(access);
    if (!file.size || file.size > OUTPUT_FILE_MAX_BYTES) throw new Error("invalid_file");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateOutputFile(file.name, file.type, bytes)) throw new Error("invalid_file");
    const client = createServiceRoleSupabaseClient();
    const id = crypto.randomUUID();
    const path = `${access.userId}/${id}`;
    // Trusted Storage operation: actor comes only from verified Auth.
    const stored = await client.storage.from("result-files").upload(path, bytes, { contentType: file.type, upsert: false });
    if (stored.error) throw stored.error;
    const record = await client.from("research_output_uploads").insert({ id, uploaded_by: access.userId, storage_path: path,
      file_name: file.name, file_size: bytes.length, mime_type: outputFileMimeSchema.parse(file.type), ready: true });
    if (record.error) {
      await client.storage.from("result-files").remove([path]);
      throw record.error;
    }
    return { id, name: file.name, size: bytes.length };
  }
  async download(id: string, version: number, fileId: string) {
    if (!isSupabaseConfigured()) return null;
    // Session reads are no-store; authorization must be checked on every click.
    const file = await new ResearchOutputRepository(await createServerSupabaseClient()).resolveFile(id, version, fileId);
    if (!file) return null;
    const { data, error } = await createServiceRoleSupabaseClient().storage.from("result-files")
      .createSignedUrl(file.path, 60, { download: file.name });
    if (error) throw error;
    return data?.signedUrl ?? null;
  }
}
