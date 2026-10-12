import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import { accountRecordsSchema, type AccountSection } from "@/lib/validation/account-records";

export class AccountRecordsRepository {
  constructor(private readonly client: DatabaseClient) {}

  async list(locale: Locale, section: AccountSection, page = 1, id: string | null = null) {
    const { data, error } = await this.client.rpc("list_account_records", { p_locale: locale, p_section: section, p_page: page, p_id: id });
    if (error) throw error;
    return accountRecordsSchema.parse(data);
  }

  async claimApplications() {
    const { data, error } = await this.client.rpc("claim_account_applications");
    if (error) throw error;
    if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) throw new Error("Invalid claim result");
    return data;
  }
}
