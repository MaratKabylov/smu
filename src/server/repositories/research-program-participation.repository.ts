import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import { accountResearchProgramSchema, managedParticipationSchema } from "@/lib/validation/research-program-participation";

export class ResearchProgramParticipationRepository {
  constructor(private readonly client: DatabaseClient) {}
  async account(id: string, locale: Locale) {
    const { data, error } = await this.client.rpc("get_account_research_program", { p_application: id, p_locale: locale });
    if (error) throw error;
    return data === null ? null : accountResearchProgramSchema.parse(data);
  }
  async get(id: string) {
    const { data, error } = await this.client.rpc("get_research_program_participation", { p_application: id });
    if (error) throw error;
    return data === null ? null : managedParticipationSchema.parse(data);
  }
  async assign(id: string, mentorId: string | null, version: number) {
    const { error } = await this.client.rpc("assign_research_program_mentor", { p_application: id, p_mentor: mentorId, p_version: version });
    if (error) throw error;
  }
}
