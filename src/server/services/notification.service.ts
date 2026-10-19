import "server-only";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/locales";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NotificationRepository } from "@/server/repositories/notification.repository";

export class NotificationService {
  private async repository() {
    if (!isSupabaseConfigured()) throw new Error("setup");
    const client = await createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.email_confirmed_at || user.is_anonymous) throw new Error("session");
    return new NotificationRepository(client);
  }
  async list(page: number) { return (await this.repository()).list(z.number().int().min(1).max(100000).parse(page)); }
  async markRead(id: string | null) { return (await this.repository()).markRead(z.uuid().nullable().parse(id)); }
  async setLocale(locale: Locale) { return (await this.repository()).setLocale(locale); }
}
