"use server";

import { redirect } from "next/navigation";
import { requireLocale } from "@/lib/i18n/server";
import type { AccountFormState, AccountMode } from "@/lib/validation/account";
import { AccountService } from "@/server/services/account.service";

export async function submitAccountForm(localeValue: string, mode: AccountMode, _state: AccountFormState, form: FormData): Promise<AccountFormState> {
  const locale = requireLocale(localeValue);
  let result: AccountFormState & { navigate?: boolean };
  try { result = await new AccountService().submit(locale, mode, form); }
  catch { return { message: "failed" }; }
  if (result.navigate) redirect(`/${locale}/account`);
  return { message: result.message };
}

export async function logoutAccount(localeValue: string): Promise<void> {
  const locale = requireLocale(localeValue);
  let failed = false;
  try { failed = Boolean((await new AccountService().logout()).message); }
  catch { failed = true; }
  if (failed) redirect(`/${locale}/account?error=logout`);
  redirect(`/${locale}/account/login`);
}
