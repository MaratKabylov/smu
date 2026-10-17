"use client";
import { useActionState } from "react";
import type { Locale } from "@/lib/i18n/locales";
import { supportCopy } from "@/lib/i18n/support-request";
import { supportFields, supportPriorities, type SupportKind, type SupportRecord } from "@/lib/validation/support-request";
import { submitSupportRequest, updateSupportRequest, type SupportFormState } from "@/server/actions/support-request.actions";

export function SupportForm({ locale, kind }: { locale: Locale; kind: SupportKind }) {
  const copy = supportCopy[locale];
  const [state, action, pending] = useActionState(submitSupportRequest.bind(null, locale, kind), {} as SupportFormState);
  return <form action={action} className="login-form support-form">
    <p>{copy.guest}</p><fieldset disabled={pending || state.message === "saved"}>
      <label>{copy.contactName}<input name="contactName" required minLength={2} maxLength={160} autoComplete="name" /></label>
      <label>{copy.email}<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label>{copy.organization}<input name="organization" maxLength={200} autoComplete="organization" /></label>
      <label>{copy.name}<input name="title" required minLength={3} maxLength={200} /></label>
      <label>{copy.description}<textarea name="description" required minLength={20} maxLength={20000} rows={6} /></label>
      {supportFields[kind].map(field => <label key={field}>{copy.fields[field]}<textarea name={field} required minLength={2} maxLength={5000} rows={3} /></label>)}
      <label>{copy.files}<input name="files" type="file" accept="application/pdf,.pdf" multiple /></label>
      <div className="support-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="confirm-check"><input type="checkbox" name="consent" value="yes" required />{copy.consent}</label>
      <button type="submit">{pending ? copy.pending : copy.submit}</button>
    </fieldset>
    {state.message && <p role={state.message === "saved" ? "status" : "alert"} aria-live="polite">{copy[state.message]}{state.id && <> · {state.id}</>}</p>}
  </form>;
}
const transitions = { new: ["new", "in_review", "rejected"], in_review: ["in_review", "in_progress", "rejected"], in_progress: ["in_progress", "in_review", "completed", "rejected"], completed: ["completed", "in_review"], rejected: ["rejected", "in_review"] } as const;
export function SupportManageForm({ record, assignees }: { record: SupportRecord; assignees: { id: string; name: string }[] }) {
  const copy = supportCopy.ru;
  const [state, action, pending] = useActionState(updateSupportRequest.bind(null, "ru", record.id, record.version!), {} as SupportFormState);
  return <form action={action} className="login-form support-form"><fieldset disabled={pending || state.message === "saved" || state.message === "stale"}>
    <label>{copy.status}<select name="status" defaultValue={record.status}>{transitions[record.status].map(status => <option key={status} value={status}>{copy.statuses[status]}</option>)}</select></label>
    <label>{copy.priority}<select name="priority" defaultValue={record.priority}>{supportPriorities.map(priority => <option key={priority} value={priority}>{copy.priorities[priority]}</option>)}</select></label>
    <label>{copy.assignedTo}<select name="assignedTo" defaultValue={record.assignedTo ?? ""}><option value="">{copy.unassigned}</option>{record.assignedTo && !assignees.some(a => a.id === record.assignedTo) && <option value={record.assignedTo} disabled>{record.assignedTo}</option>}{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <label>{copy.note}<textarea name="note" maxLength={5000} defaultValue={record.managerNote} rows={4} /></label>
    <button type="submit">{pending ? copy.pending : copy.save}</button>
  </fieldset>{state.message && <p role={state.message === "saved" ? "status" : "alert"}>{state.message === "saved" ? "Изменения сохранены." : copy[state.message]}</p>}</form>;
}
