"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/i18n/locales";
import { accountRecordsCopy } from "@/lib/i18n/account-records";
import { claimAccountApplications, type ClaimApplicationsState } from "@/server/actions/account-records.actions";

export function ClaimApplicationsForm({ locale }: { locale: Locale }) {
  const copy = accountRecordsCopy[locale];
  const [state, action, pending] = useActionState(claimAccountApplications.bind(null, locale), {} as ClaimApplicationsState);
  return <form action={action} className="account-claim">
    <p>{copy.claimIntro}</p>
    <button type="submit" disabled={pending}>{pending ? copy.claiming : copy.claim}</button>
    {state.message && <p role={state.message === "claimed" ? "status" : "alert"} aria-live="polite">{copy[state.message]}{state.message === "claimed" ? `: ${state.count ?? 0}` : ""}</p>}
  </form>;
}
