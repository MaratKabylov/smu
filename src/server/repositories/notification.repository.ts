import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";
import { emailJobSchema, notificationPageSchema, type EmailJob } from "@/lib/validation/notifications";
import type { Locale } from "@/lib/i18n/locales";

export class NotificationRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list(page: number) { const { data, error } = await this.client.rpc("list_account_notifications", { p_page: page }); if (error) throw error; return notificationPageSchema.parse(data); }
  async markRead(id: string | null) { const { data, error } = await this.client.rpc("mark_account_notification_read", { p_id: id }); if (error) throw error; return z.number().int().nonnegative().parse(data); }
  async setLocale(locale: Locale) { const { error } = await this.client.rpc("set_notification_locale", { p_locale: locale }); if (error) throw error; }
  async claim(limit: number, worker: string): Promise<EmailJob[]> { const { data, error } = await this.client.rpc("claim_email_jobs", { p_limit: limit, p_worker: worker }); if (error) throw error; return z.array(emailJobSchema).max(50).parse(data); }
  async finish(id: string, worker: string, success: boolean, providerId: string | null, errorCode: string | null, retryable = true) { const { data, error } = await this.client.rpc("finish_email_job", { p_id: id, p_worker: worker, p_success: success, p_provider_id: providerId, p_error_code: errorCode, p_retryable: retryable }); if (error) throw error; return z.enum(["sent", "pending", "failed"]).parse(data); }
}
