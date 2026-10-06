"use server";
import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eventAdminPath } from "@/lib/events";
import { eventInputSchema, eventStatusSchema } from "@/lib/validation/event";
import { getAdminAccess } from "@/server/services/access.service";
import { EventService, EventServiceError } from "@/server/services/event.service";

async function access() {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect("/admin");
  return result.access;
}
function errorCode(error: unknown) {
  if (error instanceof EventServiceError) return error.code;
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return ["not_found", "invalid_reference", "invalid_transition", "invalid_location"].find(code => message.includes(code)) ?? "action_failed";
}
function invalidate() {
  revalidatePath(eventAdminPath, "layout");
  revalidatePath("/events", "layout");
}
export async function saveEvent(id: string | null, form: FormData) {
  if (id !== null && !z.uuid().safeParse(id).success) redirect(eventAdminPath + "?error=validation");
  const target = eventAdminPath + (id ? "/" + id : "/new");
  const userAccess = await access();
  const translation = (suffix: "Ru" | "Kk") => Object.fromEntries(
    ["title", "slug", "summary", "description", "organizer", "location"].map(key => [key, form.get(key + suffix)]));
  const input = eventInputSchema.safeParse({
    kind: form.get("kind"), format: form.get("format"), startsAt: form.get("startsAt"), endsAt: form.get("endsAt"),
    registrationDeadline: form.get("registrationDeadline"), registrationUrl: form.get("registrationUrl"),
    externalUrl: form.get("externalUrl"), coverMediaId: form.get("coverMediaId"), ru: translation("Ru"), kk: translation("Kk"),
  });
  if (!input.success) redirect(target + "?error=validation");
  let savedId: string;
  try { savedId = await new EventService().save(userAccess, input.data, id); }
  catch (error) { redirect(target + "?error=" + errorCode(error)); }
  invalidate();
  redirect(eventAdminPath + "/" + savedId + (id ? "?saved=1" : "?created=1"));
}
export async function changeEventStatus(id: string, status: string) {
  if (!z.uuid().safeParse(id).success) redirect(eventAdminPath + "?error=validation");
  const parsed = eventStatusSchema.safeParse(status);
  if (!parsed.success) redirect(eventAdminPath + "/" + id + "?error=invalid_transition");
  const userAccess = await access();
  try { await new EventService().changeStatus(userAccess, id, parsed.data); }
  catch (error) { redirect(eventAdminPath + "/" + id + "?error=" + errorCode(error)); }
  invalidate();
  redirect(eventAdminPath + "/" + id + "?status_changed=1");
}
export async function deleteEvent(id: string, form: FormData) {
  if (!z.uuid().safeParse(id).success) redirect(eventAdminPath + "?error=validation");
  const userAccess = await access();
  if (form.get("confirm") !== "yes") redirect(eventAdminPath + "/" + id + "?error=confirm_delete");
  try { await new EventService().softDelete(userAccess, id); }
  catch (error) { redirect(eventAdminPath + "/" + id + "?error=" + errorCode(error)); }
  invalidate();
  redirect(eventAdminPath + "?deleted=1");
}
