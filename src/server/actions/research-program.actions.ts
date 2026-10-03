"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { researchProgramAdminPath as base } from "@/lib/research-program";
import { applicationUpdateSchema, researchProgramApplicationSchema, researchProgramInputSchema, researchProgramStatusSchema } from "@/lib/validation/research-program";
import { getAdminAccess } from "@/server/services/access.service";
import { ResearchProgramService, ResearchProgramServiceError, PublicResearchProgramService } from "@/server/services/research-program.service";
async function access() {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect("/admin");
  return result.access;
}
function errorCode(error: unknown) {
  if (error instanceof ResearchProgramServiceError) return "forbidden";
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return ["not_found", "not_available", "applications_closed", "invalid_reference", "invalid_transition", "capacity_exceeded", "program_has_applications", "rate_limited", "duplicate_application"].find(code => message.includes(code)) ?? "action_failed";
}
function invalidate() { revalidatePath(base, "layout"); revalidatePath("/research-program", "layout"); }
export async function saveResearchProgram(id: string | null, form: FormData) {
  if (id !== null && !z.uuid().safeParse(id).success) redirect(base + "?error=validation");
  const target = base + (id ? "/" + id : "/new");
  const user = await access();
  const translation = (suffix: string) => ({ title: form.get("title" + suffix), slug: form.get("slug" + suffix), summary: form.get("summary" + suffix), description: form.get("description" + suffix), curriculum: form.get("curriculum" + suffix), eligibility: form.get("eligibility" + suffix), outcomes: form.get("outcomes" + suffix) });
  const input = researchProgramInputSchema.safeParse({ coordinatorId: form.get("coordinatorId"), fieldId: form.get("fieldId"), format: form.get("format"), capacity: form.get("capacity"), applicationsOpenOn: form.get("applicationsOpenOn"), applicationDeadline: form.get("applicationDeadline"), startsOn: form.get("startsOn"), endsOn: form.get("endsOn"), ru: translation("Ru"), kk: translation("Kk") });
  if (!input.success) redirect(target + "?error=validation");
  let saved: string;
  try { saved = await new ResearchProgramService().save(user, input.data, id); }
  catch (error) { redirect(target + "?error=" + errorCode(error)); }
  invalidate(); redirect(base + "/" + saved + "?saved=1");
}
export async function changeResearchProgram(id: string, rawStatus: string, form: FormData) {
  if (!z.uuid().safeParse(id).success) redirect(base + "?error=validation");
  const user = await access();
  const remove = rawStatus === "delete";
  const status = researchProgramStatusSchema.safeParse(rawStatus);
  if (!remove && !status.success) redirect(base + "/" + id + "?error=validation");
  if (remove && form.get("confirm") !== "yes") redirect(base + "/" + id + "?error=confirm_delete");
  try { await new ResearchProgramService().changeState(user, id, status.success ? status.data : null, remove); }
  catch (error) { redirect(base + "/" + id + "?error=" + errorCode(error)); }
  invalidate(); redirect(base + (remove ? "?deleted=1" : "/" + id + "?saved=1"));
}
export async function updateResearchProgramApplication(id: string, programId: string, form: FormData) {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(programId).success) redirect(base + "?error=validation");
  const queue = form.get("returnTo") === "queue";
  const target = queue ? base + "/applications" : base + "/" + programId;
  const user = await access();
  const input = applicationUpdateSchema.safeParse({ status: form.get("status"), note: form.get("note") });
  if (!input.success) redirect(target + "?error=validation");
  try { await new ResearchProgramService().updateApplication(user, id, input.data.status, input.data.note); }
  catch (error) { redirect(target + "?error=" + errorCode(error)); }
  invalidate(); redirect(target + "?application_saved=1" + (queue ? "" : "#applications"));
}
export async function submitResearchProgramApplication(_state: { code: string }, form: FormData): Promise<{ code: string }> {
  const input = researchProgramApplicationSchema.safeParse({ programId: form.get("programId"), locale: form.get("locale"), fullName: form.get("fullName"), email: form.get("email"), motivation: form.get("motivation"), consent: form.get("consent") === "yes", website: form.get("website") ?? "" });
  if (!input.success) return { code: "validation" };
  try { await new PublicResearchProgramService().submit(input.data); }
  catch (error) { return { code: errorCode(error) }; }
  revalidatePath(base, "layout");
  return { code: "submitted" };
}
