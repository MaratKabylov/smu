"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminAccess } from "@/server/services/access.service";
import { ResearchProgramProjectsService } from "@/server/services/research-program-projects.service";
import { programProjectsInputSchema } from "@/lib/validation/research-program-projects";
import { revalidateLocalizedPath } from "@/lib/i18n/revalidation";
import { researchProgramAdminPath } from "@/lib/research-program";
async function access() {
  const result = await getAdminAccess();
  if (result.state !== "allowed") throw new Error("forbidden");
  return result.access;
}
export async function searchResearchProgramProjects(query: string) {
  const user = await access();
  const parsed = z.string().trim().max(120).safeParse(query);
  if (!parsed.success) return { ok: false as const };
  try { return { ok: true as const, options: await new ResearchProgramProjectsService().options(user, parsed.data) }; }
  catch { return { ok: false as const }; }
}
export async function saveResearchProgramProjects(id: string, form: FormData) {
  const user = await access();
  if (!z.uuid().safeParse(id).success) redirect(researchProgramAdminPath + "?error=validation");
  const target = researchProgramAdminPath + "/" + id;
  let code = "";
  try {
    const input = programProjectsInputSchema.parse(JSON.parse(String(form.get("projects") ?? "")));
    await new ResearchProgramProjectsService().save(user, id, input);
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    code = ["forbidden", "stale_version", "invalid_reference", "not_found"].find(c => message.includes(c)) ?? "validation";
  }
  if (code) redirect(target + "?error=" + code + "#projects");
  revalidateLocalizedPath(researchProgramAdminPath, "layout");
  revalidateLocalizedPath("/research-program", "layout");
  revalidateLocalizedPath("/projects", "layout");
  redirect(target + "?saved=1#projects");
}
