"use server";
import { revalidatePath } from "next/cache";
import { isLocale, locales, type Locale } from "@/lib/i18n/locales";
import { parseLegacyForm } from "@/lib/validation/scientific-legacy";
import { ScientificLegacyError, ScientificLegacyService } from "@/server/services/scientific-legacy.service";

export type LegacyFormState = { message?: "saved" | "failed" | "session" | "invalid" | "stale"; id?: string };
function failure(error: unknown): LegacyFormState {
  if (error instanceof ScientificLegacyError) return { message: error.code === "setup" ? "failed" : error.code };
  if (error && typeof error === "object" && "message" in error && error.message === "stale_version") return { message: "stale" };
  return { message: "failed" };
}
function refresh(id: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}/account/legacy`, "layout");
    revalidatePath(`/${locale}/mentorship/legacy`, "layout");
    revalidatePath(`/${locale}/mentorship/legacy/${id}`);
  }
}
export async function saveScientificLegacy(locale: Locale, id: string | null, version: number | null, _previous: LegacyFormState, form: FormData): Promise<LegacyFormState> {
  if (!isLocale(locale)) return { message: "invalid" };
  const parsed = parseLegacyForm(id, version, form);
  if (!parsed.success) return { message: "invalid" };
  try {
    const savedId = await new ScientificLegacyService().save(parsed.data);
    refresh(savedId);
    return { message: "saved", id: savedId };
  } catch (error) { return failure(error); }
}
export async function setScientificLegacyConsent(locale: Locale, id: string, version: number, granted: boolean, _previous: LegacyFormState, form: FormData): Promise<LegacyFormState> {
  if (!isLocale(locale) || (granted && form.get("confirm") !== "yes")) return { message: "invalid" };
  try {
    await new ScientificLegacyService().consent(id, version, granted);
    refresh(id);
    return { message: "saved", id };
  } catch (error) { return failure(error); }
}
