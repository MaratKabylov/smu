"use server";
import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { redirect } from "next/navigation";
import { z } from "zod";
import { scienceWorkAdminPath, scienceWorkPath } from "@/lib/science-work";
import { scienceWorkInputSchema, scienceWorkKindSchema, scienceWorkStatusSchema } from "@/lib/validation/science-work";
import { getAdminAccess } from "@/server/services/access.service";
import { ScienceWorkService, ScienceWorkServiceError } from "@/server/services/science-work.service";
import type { ScienceWorkKind } from "@/types/domain/science-work";

function validatedKind(value: string) {
  const result = scienceWorkKindSchema.safeParse(value);
  if (!result.success) redirect("/admin");
  return result.data;
}
async function access() {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect("/admin");
  return result.access;
}
function errorCode(error: unknown) {
  if (error instanceof ScienceWorkServiceError) return error.code;
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return ["not_found", "invalid_reference", "invalid_transition"].find(code => message.includes(code)) ?? "action_failed";
}
function invalidate(kind: ScienceWorkKind) {
  revalidatePath(scienceWorkAdminPath(kind), "layout");
  revalidatePath(scienceWorkPath(kind), "layout");
}
function inputFromForm(form: FormData) {
  const translation = (locale: "Ru" | "Kk" | "En") => ({
    title: form.get("title" + locale), slug: form.get("slug" + locale),
    summary: form.get("summary" + locale), description: form.get("description" + locale),
    results: form.get("results" + locale),
  });
  const en = translation("En");
  const hasEnglish = Object.values(en).some(value => String(value ?? "").trim().length > 0);
  return scienceWorkInputSchema.safeParse({
    stage: form.get("stage"), organizationId: form.get("organizationId"), fieldId: form.get("fieldId"),
    coverMediaId: form.get("coverMediaId"), startDate: form.get("startDate"), endDate: form.get("endDate"),
    externalUrl: form.get("externalUrl"), doi: form.get("doi"), leadScientistId: form.get("leadScientistId"),
    memberIds: form.getAll("memberIds"), ru: translation("Ru"), kk: translation("Kk"), ...(hasEnglish ? { en } : {}),
  });
}
export async function saveScienceWork(rawKind: string, id: string | null, form: FormData) {
  const kind = validatedKind(rawKind);
  const base = scienceWorkAdminPath(kind);
  if (id !== null && !z.uuid().safeParse(id).success) redirect(base + "?error=validation");
  const target = base + (id ? "/" + id : "/new");
  const userAccess = await access();
  const input = inputFromForm(form);
  if (!input.success) redirect(target + "?error=validation");
  let savedId: string;
  try {
    savedId = await new ScienceWorkService().save(userAccess, kind, input.data, id);
  } catch (error) { redirect(target + "?error=" + errorCode(error)); }
  invalidate(kind);
  redirect(base + "/" + savedId + (id ? "?saved=1" : "?created=1"));
}
export async function changeScienceWorkStatus(rawKind: string, id: string, status: string) {
  const kind = validatedKind(rawKind);
  const base = scienceWorkAdminPath(kind);
  if (!z.uuid().safeParse(id).success) redirect(base + "?error=validation");
  const parsed = scienceWorkStatusSchema.safeParse(status);
  if (!parsed.success) redirect(base + "/" + id + "?error=invalid_transition");
  const userAccess = await access();
  try { await new ScienceWorkService().changeStatus(userAccess, kind, id, parsed.data); }
  catch (error) { redirect(base + "/" + id + "?error=" + errorCode(error)); }
  invalidate(kind);
  redirect(base + "/" + id + "?status_changed=1");
}
export async function deleteScienceWork(rawKind: string, id: string, form: FormData) {
  const kind = validatedKind(rawKind);
  const base = scienceWorkAdminPath(kind);
  if (!z.uuid().safeParse(id).success) redirect(base + "?error=validation");
  const userAccess = await access();
  if (form.get("confirm") !== "yes") redirect(base + "/" + id + "?error=confirm_delete");
  try { await new ScienceWorkService().softDelete(userAccess, kind, id); }
  catch (error) { redirect(base + "/" + id + "?error=" + errorCode(error)); }
  invalidate(kind);
  redirect(base + "?deleted=1");
}
