import "server-only";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { SUPPORT_FILE_MAX_BYTES, supportInputSchema, supportKindSchema, supportStatuses, supportUpdateSchema, validSupportFile, type SupportKind } from "@/lib/validation/support-request";
import { SupportRequestRepository, type SupportFileMetadata } from "@/server/repositories/support-request.repository";

export class SupportRequestService {
  private async session() {
    if (!isSupabaseConfigured()) throw new Error("setup");
    const client = await createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) throw new Error("session");
    return new SupportRequestRepository(client);
  }
  async submit(raw: unknown, files: File[]) {
    const input = supportInputSchema.parse(raw);
    if (!isSupabaseConfigured()) throw new Error("setup");
    if (files.length > 3 || files.some(file => !file.size || file.size > SUPPORT_FILE_MAX_BYTES)) throw new Error("invalid_file");
    // Inspect all bytes before writing anything. Only bounded PDF attachments.
    const checked: { file: File; bytes: Uint8Array }[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!validSupportFile(file, bytes)) throw new Error("invalid_file");
      checked.push({ file, bytes });
    }
    const session = await createServerSupabaseClient();
    const { data: { user }, error } = await session.auth.getUser();
    // Auth failure is not silently converted into guest ownership.
    if (error && error.name !== "AuthSessionMissingError") throw new Error("session");
    if (user && (!user.email || !user.email_confirmed_at || user.is_anonymous)) throw new Error("session");
    const owner = user?.id ?? null;
    if (user?.email) input.email = user.email.trim().toLowerCase();
    const trusted = createServiceRoleSupabaseClient();
    const id = crypto.randomUUID();
    const paths: string[] = [];
    const metadata: SupportFileMetadata[] = [];
    try {
      for (const { file, bytes } of checked) {
        const fileId = crypto.randomUUID(); const path = `${id}/${fileId}`;
        const { error } = await trusted.storage.from("support-request-files").upload(path, bytes, { contentType: "application/pdf", upsert: false });
        if (error) throw error;
        paths.push(path);
        metadata.push({ id: fileId, path, name: file.name, size: bytes.length, mimeType: "application/pdf" });
      }
      return await new SupportRequestRepository(trusted).submit(id, input, metadata, owner);
    } catch (error) {
      // Compensate a failed upload or rolled-back metadata transaction.
      if (paths.length) await trusted.storage.from("support-request-files").remove(paths).catch(() => undefined);
      throw error;
    }
  }
  async list(kind: SupportKind, manage = false, page = 1, id: string | null = null, status = "all") {
    supportKindSchema.parse(kind);
    z.number().int().min(1).max(100000).parse(page);
    z.uuid().nullable().parse(id);
    z.enum(["all", ...supportStatuses]).parse(status);
    z.boolean().parse(manage);
    return (await this.session()).list(kind, manage, page, id, status);
  }
  async update(raw: unknown) { return (await this.session()).update(supportUpdateSchema.parse(raw)); }
  async assignees(kind: SupportKind) { return (await this.session()).assignees(supportKindSchema.parse(kind)); }
  async download(request: string, file: string) {
    z.uuid().parse(request); z.uuid().parse(file);
    const resolved = await (await this.session()).file(request, file);
    if (!resolved) return null;
    // Resolve against the current session on every click, before touching Storage.
    const { data, error } = await createServiceRoleSupabaseClient().storage.from("support-request-files").download(resolved.path);
    if (error || !data) throw new Error("download_failed");
    return { blob: data, name: resolved.name };
  }
}
