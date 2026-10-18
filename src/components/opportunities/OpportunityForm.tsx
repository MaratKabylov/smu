"use client";
import { useActionState } from "react";
import { eventLocalInput } from "@/lib/events";
import { opportunityTypes, type Opportunity } from "@/lib/validation/opportunity";
import { opportunityTypeLabels, opportunityErrorMessage } from "@/lib/i18n/opportunity";

export function OpportunityForm({ action, opportunity }: {
  action: (previous: { error?: string }, form: FormData) => Promise<{ error?: string }>; opportunity?: Opportunity;
}) {
  const [state, submit, pending] = useActionState<{ error?: string; values?: Record<string, string> }, FormData>(async (_previous, form) => {
    const result = await action({}, form);
    // React resets uncontrolled forms after an action returns. Keep submitted
    // values as the new defaults when validation or a version check fails.
    return { ...result, values: Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)])) };
  }, {});
  const field = (name: string, initial: string) => state.values?.[name] ?? initial;
  return <form action={submit} className="article-form">
    {state.error && <p role="alert" className="notice error-notice">{opportunityErrorMessage(state.error)}</p>}
    <fieldset disabled={pending} className="opportunity-fields">
      <section className="article-editor-panel"><h2>Условия участия</h2><div className="form-three-columns">
        <label>Тип<select name="type" defaultValue={field("type", opportunity?.type ?? "grant")}>{opportunityTypes.map(type => <option key={type} value={type}>{opportunityTypeLabels.ru[type]}</option>)}</select></label>
        <label>Код страны<input name="country" defaultValue={field("country", opportunity?.country ?? "")} pattern="[A-Za-z]{2}" maxLength={2} placeholder="KZ" /><small>Две латинские буквы; пусто — международная / не указана.</small></label>
        <label>Срок подачи (Актобе, UTC+5)<input type="datetime-local" name="deadline" defaultValue={field("deadline", eventLocalInput(opportunity?.deadline))} /><small>Пусто — срок не указан. Приём закрывается в указанное время.</small></label>
        <label>Первоисточник<input type="url" name="sourceUrl" defaultValue={field("sourceUrl", opportunity?.sourceUrl ?? "")} required maxLength={2000} placeholder="https://…" /></label>
      </div></section>
      <div className="translation-grid">{(["ru", "kk", "en"] as const).map(locale => {
        const value = opportunity?.translations.find(t => t.locale === locale), required = locale !== "en";
        return <section key={locale} className="article-editor-panel translation-panel"><h2>{locale === "ru" ? "Русская версия" : locale === "kk" ? "Қазақша нұсқа" : "English (optional)"}</h2><div className="translation-fields">
          <label>Название<input name={"title_" + locale} defaultValue={field("title_" + locale, value?.title ?? "")} required={required} minLength={3} maxLength={240} /></label>
          <label>URL slug<input name={"slug_" + locale} defaultValue={field("slug_" + locale, value?.slug ?? "")} required={required} minLength={2} maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /><small>Прежние адреса сохраняются и перенаправляют на текущий.</small></label>
          <label>Краткое описание<textarea name={"summary_" + locale} defaultValue={field("summary_" + locale, value?.summary ?? "")} required={required} minLength={20} maxLength={800} rows={3} /></label>
          <label>Описание<textarea name={"description_" + locale} defaultValue={field("description_" + locale, value?.description ?? "")} required={required} minLength={40} maxLength={30000} rows={9} /></label>
          <label>Организация<input name={"organization_" + locale} defaultValue={field("organization_" + locale, value?.organization ?? "")} required={required} minLength={2} maxLength={240} /></label>
          <label>Финансирование<textarea name={"funding_" + locale} defaultValue={field("funding_" + locale, value?.funding ?? "")} maxLength={1000} rows={3} /></label>
        </div></section>;
      })}</div>
    </fieldset>
    <div className="article-form-actions"><button type="submit" className="primary-button" disabled={pending}>{pending ? "Сохранение…" : "Сохранить черновик"}</button></div>
  </form>;
}
