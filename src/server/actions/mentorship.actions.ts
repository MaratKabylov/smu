"use server";
import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mentorshipAdminPath as base } from "@/lib/mentorship";
import { applicationUpdateSchema, mentorshipApplicationSchema, mentorshipInputSchema, mentorshipStatusSchema } from "@/lib/validation/mentorship";
import { getAdminAccess } from "@/server/services/access.service";
import { MentorshipService, MentorshipServiceError, PublicMentorshipService } from "@/server/services/mentorship.service";
async function access() {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect("/admin");
  return result.access;
}
function errorCode(error: unknown) {
  if (error instanceof MentorshipServiceError) return "forbidden";
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return ["not_found", "not_available", "invalid_reference", "invalid_transition", "capacity_exceeded", "mentor_has_applications", "rate_limited", "duplicate_application"].find(code => message.includes(code)) ?? "action_failed";
}
function invalidate() { revalidatePath(base, "layout"); revalidatePath("/mentorship", "layout"); }
export async function saveMentorshipOffer(id: string | null, form: FormData) {
  if (id !== null && !z.uuid().safeParse(id).success) redirect(base + "?error=validation");
  const target = base + (id ? "/" + id : "/new");
  const user = await access();
  const translation = (suffix: string) => ({ title: form.get("title" + suffix), slug: form.get("slug" + suffix), summary: form.get("summary" + suffix), description: form.get("description" + suffix) });
  const en = translation("En");
  const hasEnglish = Object.values(en).some(value => String(value ?? "").trim().length > 0);
  const input = mentorshipInputSchema.safeParse({ scientistId: form.get("scientistId"), fieldId: form.get("fieldId"), format: form.get("format"), capacity: form.get("capacity"), ru: translation("Ru"), kk: translation("Kk"), ...(hasEnglish ? { en } : {}) });
  if (!input.success) redirect(target + "?error=validation");
  let saved: string;
  try { saved = await new MentorshipService().save(user, input.data, id); }
  catch (error) { redirect(target + "?error=" + errorCode(error)); }
  invalidate(); redirect(base + "/" + saved + "?saved=1");
}
export async function changeMentorshipOffer(id: string, rawStatus: string, form: FormData) {
  if (!z.uuid().safeParse(id).success) redirect(base + "?error=validation");
  const user = await access();
  const remove = rawStatus === "delete";
  const status = mentorshipStatusSchema.safeParse(rawStatus);
  if (!remove && !status.success) redirect(base + "/" + id + "?error=validation");
  if (remove && form.get("confirm") !== "yes") redirect(base + "/" + id + "?error=confirm_delete");
  try { await new MentorshipService().changeState(user, id, status.success ? status.data : null, remove); }
  catch (error) { redirect(base + "/" + id + "?error=" + errorCode(error)); }
  invalidate(); redirect(base + (remove ? "?deleted=1" : "/" + id + "?saved=1"));
}
export async function updateMentorshipApplication(id: string, offerId: string, form: FormData) {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(offerId).success) redirect(base + "?error=validation");
  const queue = form.get("returnTo") === "queue";
  const target = queue ? base + "/applications" : base + "/" + offerId;
  const user = await access();
  const input = applicationUpdateSchema.safeParse({ status: form.get("status"), note: form.get("note") });
  if (!input.success) redirect(target + "?error=validation");
  try { await new MentorshipService().updateApplication(user, id, input.data.status, input.data.note); }
  catch (error) { redirect(target + "?error=" + errorCode(error)); }
  invalidate(); redirect(target + "?application_saved=1" + (queue ? "" : "#applications"));
}
export async function submitMentorshipApplication(_state: { code: string }, form: FormData): Promise<{ code: string }> {
  const input = mentorshipApplicationSchema.safeParse({ offerId: form.get("offerId"), locale: form.get("locale"), fullName: form.get("fullName"), email: form.get("email"), motivation: form.get("motivation"), consent: form.get("consent") === "yes", website: form.get("website") ?? "" });
  if (!input.success) return { code: "validation" };
  try { await new PublicMentorshipService().submit(input.data); }
  catch (error) { return { code: errorCode(error) }; }
  revalidatePath(base, "layout");
  return { code: "submitted" };
}
