"use client";

import { useActionState } from "react";
import { accountCopy } from "@/lib/i18n/account";
import type { Locale } from "@/lib/i18n/locales";
import type { AccountFormState, AccountMode } from "@/lib/validation/account";
import { submitAccountForm } from "@/server/actions/account.actions";

export function AccountForm({ locale, mode }: { locale: Locale; mode: AccountMode }) {
  const copy = accountCopy[locale];
  const [state, action, pending] = useActionState(submitAccountForm.bind(null, locale, mode), {} as AccountFormState);
  const newPassword = mode === "register" || mode === "update-password";
  const done = state.message === "sent" || (mode === "update-password" && state.message === "saved");
  return <form action={action} className="login-form">
    {mode === "register" && <label>{copy.displayName}<input name="displayName" autoComplete="name" minLength={2} maxLength={120} required disabled={pending || done} /></label>}
    {mode !== "update-password" && <label>{copy.email}<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending || done} /></label>}
    {mode !== "recover" && <label>{copy.password}<input name="password" type="password" autoComplete={newPassword ? "new-password" : "current-password"} minLength={newPassword ? 8 : 1} maxLength={256} required disabled={pending || done} aria-describedby={newPassword ? "password-hint" : undefined} /></label>}
    {newPassword && <><small id="password-hint">{copy.passwordHint}</small><label>{copy.confirmPassword}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={256} required disabled={pending || done} /></label></>}
    {state.message && <div className={done ? "account-notice" : "form-error"} role={done ? "status" : "alert"}>{copy.messages[state.message]}</div>}
    <button type="submit" disabled={pending || done}>{pending ? copy.pending : copy.submit}</button>
  </form>;
}
