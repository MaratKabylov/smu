"use client";

import { useActionState } from "react";
import { locales } from "@/lib/i18n/locales";
import { contentLabels, type ContentPage, type SiteContentCatalog } from "@/lib/validation/site-content";

type RecordProps =
  | { kind: "page"; record: ContentPage }
  | { kind: "section"; record: SiteContentCatalog["sections"][number] }
  | { kind: "setting"; record: SiteContentCatalog["settings"][number] };
type Result = { error?: string; version?: number };
const errors: Record<string, string> = {
  stale_version: "Запись уже изменена. Скопируйте свои правки и обновите страницу перед повторным сохранением.",
  forbidden: "Недостаточно прав для сохранения.",
  invalid_input: "Проверьте поля. Для публикации нужны русская и казахская версии; у кнопки должны быть подпись и безопасная ссылка.",
  not_found: "Запись больше недоступна.",
};

export function SiteContentForm({ action, ...props }: RecordProps & { action: (value: unknown) => Promise<Result> }) {
  const { kind, record } = props;
  const [state, submit, pending] = useActionState<Result & { values?: Record<string, string> }, FormData>(async (previous, form) => {
    const values = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
    const get = (key: string) => values[key] ?? "";
    let data: unknown;
    try {
      if (kind === "page") data = {
        status: get("status"),
        translations: locales.map(locale => ({
          locale, title: get(`title_${locale}`), summary: get(`summary_${locale}`), body: get(`body_${locale}`),
          cta_label: get(`cta_label_${locale}`), cta_href: get(`cta_href_${locale}`),
        })).filter(t => [t.title, t.summary, t.body, t.cta_label, t.cta_href].some(Boolean)),
      };
      else if (kind === "section") data = {
        enabled: get("enabled") === "on", sort_order: Number(get("sort_order")), display_limit: Number(get("display_limit")),
        titles: Object.fromEntries(locales.map(locale => [locale, get(`title_${locale}`)])),
      };
      else data = { value: record.key === "social_links" ? Array.from({ length: 10 }, (_, index) => ({ label: get(`label_${index}`), href: get(`href_${index}`) })).filter(link => link.label || link.href) : get("value") };
    } catch { return { ...previous, error: "invalid_input", values }; }
    let result: Result;
    try { result = await action({ kind, key: record.key, version: previous.version ?? record.version, data }); }
    catch { result = { error: "save_failed" }; }
    // Preserve submitted defaults after React resets a completed form, including failures.
    return { ...result, version: result.version ?? previous.version, values };
  }, {});
  const field = (name: string, initial = "") => state.values?.[name] ?? initial;
  return <form action={submit} className="site-content-form">
    {state.error ? <p role="alert" className="notice error-notice">{errors[state.error] ?? "Не удалось сохранить. Повторите попытку."}</p>
      : state.version !== undefined ? <p role="status" className="notice">Сохранено · версия {state.version}</p> : null}
    <fieldset disabled={pending}>
      {props.kind === "page" ? <>
        <div className="content-page-meta"><p>Шаблон: <strong>{props.record.template}</strong> · постоянный адрес: <code>/[locale]/pages/{record.key}</code></p>
          <label>Состояние<select name="status" defaultValue={field("status", props.record.status)}><option value="draft">Черновик</option><option value="published">Опубликовано</option></select></label>
          <p>Для публикации заполните RU и KK. EN — по желанию. Чтобы удалить перевод, очистите все его поля. Текст отображается абзацами; HTML и скрипты не исполняются.</p>
        </div>
        <div className="translation-grid">{locales.map(locale => {
          const translation = props.record.translations.find(t => t.locale === locale);
          return <section className="article-editor-panel" key={locale}><h3>{locale.toUpperCase()}</h3>
            <label>Заголовок<input name={`title_${locale}`} maxLength={200} defaultValue={field(`title_${locale}`, translation?.title)} /></label>
            <label>Краткое описание<textarea name={`summary_${locale}`} maxLength={600} rows={3} defaultValue={field(`summary_${locale}`, translation?.summary)} /></label>
            <label>Текст<textarea name={`body_${locale}`} maxLength={30000} rows={12} defaultValue={field(`body_${locale}`, translation?.body)} /></label>
            <label>Подпись кнопки<input name={`cta_label_${locale}`} maxLength={80} defaultValue={field(`cta_label_${locale}`, translation?.cta_label)} /></label>
            <label>Ссылка кнопки<input name={`cta_href_${locale}`} maxLength={500} placeholder="https://… или /ru/support" defaultValue={field(`cta_href_${locale}`, translation?.cta_href)} /></label>
          </section>;
        })}</div>
      </> : props.kind === "section" ? <>
        <label className="confirm-check"><input type="checkbox" name="enabled" defaultChecked={state.values ? state.values.enabled === "on" : props.record.enabled} />Показывать блок</label>
        <div className="form-three-columns"><label>Порядок<input type="number" name="sort_order" min={0} max={100} required defaultValue={field("sort_order", String(props.record.sort_order))} /></label>
          <label>Количество элементов<input type="number" name="display_limit" min={1} max={12} required defaultValue={field("display_limit", String(props.record.display_limit))} /></label></div>
        {locales.map(locale => <label key={locale}>Заголовок {locale.toUpperCase()}<input name={`title_${locale}`} maxLength={200} defaultValue={field(`title_${locale}`, props.record.titles[locale])} /></label>)}
        <small>Пустой заголовок использует стандартное название блока. При одинаковом порядке блоки сортируются по коду.</small>
      </> : <div>
        {record.key === "social_links" ? <span className="content-social-links">{Array.from({ length: 10 }, (_, index) => {
          const links = props.record.value as Array<{ label: string; href: string }>;
          return <span key={index} className="content-social-link"><span>Ссылка {index + 1}</span><input aria-label={`Название ссылки ${index + 1}`} name={`label_${index}`} maxLength={80} placeholder="Название" defaultValue={field(`label_${index}`, links[index]?.label)} /><input aria-label={`Адрес ссылки ${index + 1}`} name={`href_${index}`} maxLength={500} placeholder="https://…" defaultValue={field(`href_${index}`, links[index]?.href)} /></span>;
        })}<small>До 10 ссылок. Чтобы удалить ссылку, очистите название и адрес.</small></span>
          : <label>{contentLabels[record.key]}<input type={record.key === "contact_email" ? "email" : "text"} name="value" maxLength={record.key === "site_name" ? 120 : 254} required={record.key === "site_name"} defaultValue={field("value", String(props.record.value))} /></label>}
      </div>}
    </fieldset>
    <button className="primary-button" type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</button>
  </form>;
}
