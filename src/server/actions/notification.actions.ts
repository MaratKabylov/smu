"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { NotificationService } from "@/server/services/notification.service";

const target = (locale: Locale) => `/${locale}/account/notifications`;
export async function markNotificationRead(locale: Locale, id: string | null) {
  if (!isLocale(locale)) return;
  try { await new NotificationService().markRead(id); } catch { redirect(`/${locale}/account/login`); }
  revalidatePath(target(locale));
}
export async function setNotificationLocale(locale: Locale, form: FormData) {
  if (!isLocale(locale)) return;
  const selected = form.get("locale");
  if (!isLocale(selected)) redirect(`${target(locale)}?error=validation`);
  try { await new NotificationService().setLocale(selected); } catch { redirect(`${target(locale)}?error=save`); }
  revalidatePath(target(locale)); redirect(`/${selected}/account/notifications?saved=1`);
}
