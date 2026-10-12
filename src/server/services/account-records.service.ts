import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { canAccessAdmin, canEditArticle, canEditScientist, canManageProjects, canManageResearch } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { accountPageSchema, accountRecordIdSchema, accountSectionSchema, type AccountSection } from "@/lib/validation/account-records";
import { AccountRecordsRepository } from "@/server/repositories/account-records.repository";
import { AccessRepository } from "@/server/repositories/access.repository";
import { MentorshipRepository } from "@/server/repositories/mentorship.repository";

export class AccountRecordsError extends Error {
  constructor(public readonly code: "session" | "invalid" | "setup") { super(code); }
}

export class AccountRecordsService {
  private async session() {
    if (!isSupabaseConfigured()) throw new AccountRecordsError("setup");
    const client = await createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) throw new AccountRecordsError("session");
    return { client, user };
  }

  async list(locale: Locale, section: AccountSection, page = 1) {
    if (!isLocale(locale) || !accountSectionSchema.safeParse(section).success || !accountPageSchema.safeParse(page).success) throw new AccountRecordsError("invalid");
    const { client } = await this.session();
    return new AccountRecordsRepository(client).list(locale, section, page);
  }

  async get(locale: Locale, section: AccountSection, id: string) {
    if (!isLocale(locale) || !accountSectionSchema.safeParse(section).success || !accountRecordIdSchema.safeParse(id).success) throw new AccountRecordsError("invalid");
    const { client, user } = await this.session();
    const record = (await new AccountRecordsRepository(client).list(locale, section, 1, id)).items[0];
    if (!record) return null;
    // The account RPC has already constrained ownership, including for admins.
    // Reuse existing editors only when the actual DB permissions allow them.
    const access = await new AccessRepository(client).getForUser(user.id);
    let editor: string | null = null;
    if (canAccessAdmin(access)) {
      if (record.kind === "article" && canEditArticle(access, user.id)) editor = `/admin/content/articles/${record.id}`;
      if (record.kind === "scientist" && canEditScientist(access)) editor = `/admin/science/scientists/${record.id}`;
      if (record.kind === "project" && canManageProjects(access)) editor = `/admin/science/projects/${record.id}`;
      if (record.kind === "research" && canManageResearch(access)) editor = `/admin/science/research/${record.id}`;
    }
    return { record, editor };
  }

  async claimApplications() {
    const { client } = await this.session();
    return new AccountRecordsRepository(client).claimApplications();
  }
  async mentorshipProgress(id: string) {
    if (!accountRecordIdSchema.safeParse(id).success) throw new AccountRecordsError("invalid");
    const { client } = await this.session();
    // Enforce account ownership even when this account has management permissions.
    const own = (await new AccountRecordsRepository(client).list("ru", "applications", 1, id)).items
      .some(record => record.kind === "mentorship_application");
    return own ? new MentorshipRepository(client).progress(id) : null;
  }
  async withdrawMentorship(id: string) {
    if (!accountRecordIdSchema.safeParse(id).success) throw new AccountRecordsError("invalid");
    const { client } = await this.session();
    return new MentorshipRepository(client).withdraw(id);
  }
}
