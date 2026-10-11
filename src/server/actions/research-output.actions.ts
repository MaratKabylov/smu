"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { researchOutputInputSchema } from "@/lib/validation/research-output";
import { getAdminAccess } from "@/server/services/access.service";
import { ResearchOutputService } from "@/server/services/research-output.service";
import { databaseErrorCode } from "@/lib/security/database-error";
import { revalidateLocalizedPath } from "@/lib/i18n/revalidation";
const path = "/admin/science/results";
export async function searchOutputWorks(query: string) {
  if (!z.string().trim().max(120).safeParse(query).success) return { ok: false as const };
  const result = await getAdminAccess();
  if (result.state !== "allowed") return { ok: false as const };
  try { return { ok: true as const, options: await new ResearchOutputService().workOptions(result.access, query.trim()) }; }
  catch { return { ok: false as const }; }
}
export async function saveResearchOutput(form: FormData) {
  const rawId = form.get("id");
  const id = rawId ? z.uuid().safeParse(rawId) : null;
  let files: unknown;
  try { files = JSON.parse(String(form.get("files") ?? "[]")); }
  catch { redirect(`${path}?error=validation`); }
  const translation = (locale: string) => ({ title: form.get(`${locale}.title`), description: form.get(`${locale}.description`) });
  const input = researchOutputInputSchema.safeParse({ ...Object.fromEntries(form), files, workIds: form.getAll("workIds"),
    expectedVersion: form.get("expectedVersion") || undefined,
    ru: translation("ru"), kk: translation("kk"), en: form.get("en.title") || form.get("en.description") ? translation("en") : undefined });
  if (!input.success || (id && !id.success)) redirect(`${path}?error=validation`);
  const access = await getAdminAccess();
  if (access.state === "unauthenticated") redirect("/admin/login");
  if (access.state !== "allowed") redirect(`${path}?error=forbidden`);
  let saved: string;
  try { saved = await new ResearchOutputService().save(access.access, id?.success ? id.data : null, input.data); }
  catch (error) { redirect(`${path}?${id?.success ? `edit=${id.data}&` : ""}error=${databaseErrorCode(error) ?? "action_failed"}`); }
  for (const target of [path, "/research", "/projects"]) revalidateLocalizedPath(target, "layout");
  redirect(`${path}?edit=${saved}&saved=1`);
}
