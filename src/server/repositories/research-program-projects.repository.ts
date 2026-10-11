import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";
import { programProjectOptionSchema, programProjectsSchema, publicProgramProjectSchema, type ProgramProjectsInput } from "@/lib/validation/research-program-projects";
import type { ScientistLocale } from "@/types/domain/scientist";
export class ResearchProgramProjectsRepository {
  constructor(private readonly client: DatabaseClient) {}
  async get(id: string) {
    const { data, error } = await this.client.rpc("get_research_program_projects", { p_id: id });
    if (error) throw error;
    return programProjectsSchema.parse(data);
  }
  async options(query = "", ids: string[] | null = null) {
    const { data, error } = await this.client.rpc("research_program_project_options", { p_query: query, p_ids: ids });
    if (error) throw error;
    return z.array(programProjectOptionSchema).parse(data);
  }
  async save(id: string, input: ProgramProjectsInput) {
    const { data, error } = await this.client.rpc("save_research_program_projects", { p_id: id, p_input: input });
    if (error) throw error;
    return data;
  }
  async publicByProgram(id: string, locale: ScientistLocale) {
    const { data, error } = await this.client.rpc("list_public_research_program_projects", { p_id: id, p_locale: locale });
    if (error) throw error;
    return z.array(publicProgramProjectSchema).parse(data);
  }
  async publicByProject(id: string, locale: ScientistLocale) {
    const { data, error } = await this.client.rpc("list_public_programs_by_project", { p_work_id: id, p_locale: locale });
    if (error) throw error;
    return z.array(z.object({ id: z.uuid(), title: z.string(), slug: z.string() })).parse(data);
  }
}
