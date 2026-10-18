"use server";
import { revalidatePath } from "next/cache";
import { isLocale, locales, type Locale } from "@/lib/i18n/locales";
import { parseSupportForm, supportKinds, supportUpdateSchema, type SupportKind } from "@/lib/validation/support-request";
import { SupportRequestService } from "@/server/services/support-request.service";
import { protectPublicForm, PublicFormProtectionError } from "@/server/services/public-form-protection.service";
export type SupportFormState = { message?: "saved" | "failed" | "invalid" | "session" | "rate" | "stale" | "file"; id?: string };
function failure(error: unknown): SupportFormState {
  if (error instanceof PublicFormProtectionError && error.code === "invalid_input") return { message: "invalid" };
  const message = error && typeof error === "object" && "message" in error ? error.message : "";
  return { message: message === "stale_version" ? "stale" : message === "rate_limited" ? "rate" : message === "invalid_file" ? "file" : message === "session" ? "session" : "failed" };
}
function refresh() {
  for (const kind of supportKinds) revalidatePath(`/admin/support/${kind}`);
  for (const locale of locales) revalidatePath(`/${locale}/account/support`);
}
export async function submitSupportRequest(locale: Locale, kind: SupportKind, _previous: SupportFormState, form: FormData): Promise<SupportFormState> {
  const input = parseSupportForm(locale, kind, form);
  if (!input) return { message: "invalid" };
  const files = form.getAll("files").filter((file): file is File => file instanceof File && (file.size > 0 || file.name !== ""));
  if (form.getAll("files").some(file => !(file instanceof File))) return { message: "invalid" };
  try {
    await protectPublicForm(form, input.email);
    const id = await new SupportRequestService().submit(input, files);
    refresh(); return { message: "saved", id };
  } catch (error) { return failure(error); }
}
export async function updateSupportRequest(locale: Locale, id: string, version: number, _previous: SupportFormState, form: FormData): Promise<SupportFormState> {
  if (!isLocale(locale)) return { message: "invalid" };
  const parsed = supportUpdateSchema.safeParse({ id, version, status: form.get("status"), priority: form.get("priority"), assignedTo: form.get("assignedTo") || null, note: form.get("note") });
  if (!parsed.success) return { message: "invalid" };
  try { await new SupportRequestService().update(parsed.data); refresh(); return { message: "saved" }; }
  catch (error) { return failure(error); }
}
