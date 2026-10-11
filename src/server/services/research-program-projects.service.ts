import "server-only";
import { canAccessAdmin, canManageResearchProgram } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { ResearchProgramProjectsRepository } from "@/server/repositories/research-program-projects.repository";
import { programProjectsInputSchema, type ProgramProjectsInput } from "@/lib/validation/research-program-projects";
import type { AccessContext } from "@/types/domain/auth";
import type { ScientistLocale } from "@/types/domain/scientist";
function assertAccess(access: AccessContext) {
  if (!canAccessAdmin(access) || !canManageResearchProgram(access)) throw new Error("forbidden");
}
export class ResearchProgramProjectsService {
  async get(access: AccessContext, id: string) {
    assertAccess(access);
    const repo = new ResearchProgramProjectsRepository(await createServerSupabaseClient());
    const graph = await repo.get(id);
    const [initial, selected] = await Promise.all([repo.options(), graph.workIds.length ? repo.options("", graph.workIds) : Promise.resolve([])]);
    return { graph, options: [...new Map([...initial, ...selected].map(p => [p.id, p])).values()] };
  }
  async options(access: AccessContext, query: string) {
    assertAccess(access);
    return new ResearchProgramProjectsRepository(await createServerSupabaseClient()).options(query);
  }
  async save(access: AccessContext, id: string, input: ProgramProjectsInput) {
    assertAccess(access);
    return new ResearchProgramProjectsRepository(await createServerSupabaseClient()).save(id, programProjectsInputSchema.parse(input));
  }
  async publicByProgram(id: string, locale: ScientistLocale) {
    if (!isSupabaseConfigured()) return [];
    return new ResearchProgramProjectsRepository(createPublicSupabaseClient()).publicByProgram(id, locale);
  }
  async publicByProject(id: string, locale: ScientistLocale) {
    if (!isSupabaseConfigured()) return [];
    return new ResearchProgramProjectsRepository(createPublicSupabaseClient()).publicByProject(id, locale);
  }
}
