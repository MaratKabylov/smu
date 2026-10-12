"use client";
import { useActionState } from "react";
import { withdrawAccountMentorship, type WithdrawMentorshipState } from "@/server/actions/account-records.actions";
import { mentorshipProgressCopy } from "@/lib/i18n/mentorship-progress";
import type { Locale } from "@/lib/i18n/locales";

export function WithdrawMentorshipForm({ locale, id }: { locale: Locale; id: string }) {
  const copy = mentorshipProgressCopy[locale];
  const [state, action, pending] = useActionState(withdrawAccountMentorship.bind(null, locale, id), {} as WithdrawMentorshipState);
  return <form action={action} className="account-claim">
    <label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required disabled={pending || state.message === "saved"} />{copy.confirm}</label>
    <button type="submit" disabled={pending || state.message === "saved"}>{pending ? copy.pending : copy.withdraw}</button>
    {state.message && <p role={state.message === "saved" ? "status" : "alert"} aria-live="polite">{copy[state.message]}</p>}
  </form>;
}
