"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { AccountRecordsError, AccountRecordsService } from "@/server/services/account-records.service";

export type ClaimApplicationsState = { message?: "claimed" | "failed" | "session"; count?: number };
export async function claimAccountApplications(locale: Locale, _previous: ClaimApplicationsState): Promise<ClaimApplicationsState> {
  void _previous;
  if (!isLocale(locale)) return { message: "failed" };
  try {
    const count = await new AccountRecordsService().claimApplications();
    revalidatePath(`/${locale}/account/applications`);
    return { message: "claimed", count };
  } catch (error) {
    return { message: error instanceof AccountRecordsError && error.code === "session" ? "session" : "failed" };
  }
}
