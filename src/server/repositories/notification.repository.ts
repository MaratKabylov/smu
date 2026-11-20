import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";
import { notificationPageSchema } from "@/lib/validation/notifications";
import type { Locale } from "@/lib/i18n/locales";

export class NotificationRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list(page: number) { const { data, error } = await this.client.rpc("list_account_notifications", { p_page: page }); if (error) throw error; return notificationPageSchema.parse(data); }
  async markRead(id: string | null) { const { data, error } = await this.client.rpc("mark_account_notification_read", { p_id: id }); if (error) throw error; return z.number().int().nonnegative().parse(data); }
  async setLocale(locale: Locale) { const { error } = await this.client.rpc("set_notification_locale", { p_locale: locale }); if (error) throw error; }
}
