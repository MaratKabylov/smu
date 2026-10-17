"use client";
import Link from "next/link";
import { useActionState } from "react";
import { legacyCopy } from "@/lib/i18n/scientific-legacy";
import { locales, type Locale } from "@/lib/i18n/locales";
import { legacyKinds, type LegacyOwnerItem } from "@/lib/validation/scientific-legacy";
import { saveScientificLegacy, setScientificLegacyConsent, type LegacyFormState } from "@/server/actions/scientific-legacy.actions";

export function LegacyForm({ locale, record }: { locale: Locale; record?: LegacyOwnerItem }) {
  const copy = legacyCopy[locale];
  const [state, action, pending] = useActionState(saveScientificLegacy.bind(null, locale, record?.id ?? null, record?.version ?? null), {} as LegacyFormState);
  const locked = pending || state.message === "saved" || state.message === "stale";
  return <form action={action} className="login-form legacy-form">
    <p>{copy.ownerIntro}</p><p>{copy.publicDescription}</p>
    <fieldset disabled={locked}>
      <label>{copy.type}<select name="kind" defaultValue={record?.kind ?? "topic"}>{legacyKinds.map(kind => <option key={kind} value={kind}>{copy.kinds[kind]}</option>)}</select></label>
      <label>{copy.status}<select name="status" defaultValue={record?.status ?? "draft"}>{(["draft", "published", "archived"] as const).map(status => <option key={status} value={status}>{copy.statuses[status]}</option>)}</select></label>
      {locales.map(language => {
        const translation = record?.translations.find(t => t.locale === language);
        return <fieldset key={language}><legend>{language.toUpperCase()}{language === "en" ? ` (${copy.optional})` : ""}</legend>
          <label>{copy.name}<input name={`${language}.title`} defaultValue={translation?.title ?? ""} minLength={3} maxLength={200} required={language !== "en"} /></label>
          <label>{copy.description}<textarea name={`${language}.description`} defaultValue={translation?.description ?? ""} minLength={20} maxLength={20000} required={language !== "en"} rows={5} /></label>
        </fieldset>;
      })}
      <label>{copy.sourceText}<textarea name="sourceText" defaultValue={record?.sourceText ?? ""} maxLength={100000} rows={7} /></label>
      <label>{copy.sourceUrl}<input type="url" name="sourceUrl" defaultValue={record?.sourceUrl ?? ""} maxLength={2000} /></label>
      <label className="confirm-check"><input type="checkbox" name="rightsConfirmed" value="yes" required />{copy.rights}</label>
      <button type="submit">{pending ? copy.pending : copy.save}</button>
    </fieldset>
    {state.message && <p role={state.message === "saved" ? "status" : "alert"} aria-live="polite">{copy[state.message]}</p>}
    {state.id && <Link href={`/${locale}/account/legacy/${state.id}`}>{copy.back}</Link>}
  </form>;
}
export function LegacyConsentForm({ locale, record }: { locale: Locale; record: LegacyOwnerItem }) {
  const copy = legacyCopy[locale];
  const granted = !record.sourceConsent;
  const [state, action, pending] = useActionState(setScientificLegacyConsent.bind(null, locale, record.id, record.version, granted), {} as LegacyFormState);
  const disabled = pending || state.message === "saved" || state.message === "stale";
  return <section className="legacy-consent"><h2>{copy.source}</h2><p>{copy.version}: {record.version}</p><p>{record.sourceConsent ? copy.consentActive : copy.consentInactive}</p>
    {(record.sourceConsent || (record.status === "published" && (record.sourceText || record.sourceUrl))) && <form action={action}>
      {granted && <label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required disabled={disabled} />{copy.confirmConsent}</label>}
      <button type="submit" disabled={disabled}>{pending ? copy.pending : granted ? copy.consent : copy.revoke}</button>
      {state.message && <p role={state.message === "saved" ? "status" : "alert"} aria-live="polite">{copy[state.message]}</p>}
    </form>}
  </section>;
}
