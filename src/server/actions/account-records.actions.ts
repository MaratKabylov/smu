"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { AccountRecordsError, AccountRecordsService } from "@/server/services/account-records.service";
import { accountRecordIdSchema } from "@/lib/validation/account-records";

export type ClaimApplicationsState = { message?: "claimed" | "failed" | "session"; count?: number };
export async function claimAccountApplications(locale: Locale, _previous: ClaimApplicationsState): Promise<ClaimApplicationsState> {
  void _previous;
  if (!isLocale(locale)) return { message: "failed" };
  try {
    const count = await new AccountRecordsService().claimApplications();
    revalidatePath(`/${locale}/account/applications`);
    revalidatePath(`/${locale}/account/research-program`);
    return { message: "claimed", count };
  } catch (error) {
    return { message: error instanceof AccountRecordsError && error.code === "session" ? "session" : "failed" };
  }
}

export type WithdrawMentorshipState = { message?: "saved" | "failed" | "session" };
export async function withdrawAccountMentorship(locale: Locale, id: string, _previous: WithdrawMentorshipState, form: FormData): Promise<WithdrawMentorshipState> {
  if (!isLocale(locale) || !accountRecordIdSchema.safeParse(id).success || form.get("confirm") !== "yes") return { message: "failed" };
  try {
    await new AccountRecordsService().withdrawMentorship(id);
    for (const language of ["ru", "kk", "en"]) revalidatePath(`/${language}/account/applications`, "layout");
    revalidatePath("/admin/programs/mentorship", "layout");
    return { message: "saved" };
  } catch (error) {
    return { message: error instanceof AccountRecordsError && error.code === "session" ? "session" : "failed" };
  }
}
