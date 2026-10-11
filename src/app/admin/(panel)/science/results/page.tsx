import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getAdminAccess } from "@/server/services/access.service";
import { canEditOutputs, ResearchOutputService } from "@/server/services/research-output.service";
import { saveResearchOutput } from "@/server/actions/research-output.actions";
import { researchOutputKinds, researchOutputLabels } from "@/types/domain/research-output";
import { ResearchOutputAttachments } from "@/components/science/ResearchOutputAttachments";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string; error?: string }> }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditOutputs(result.access)) notFound();
  const state = await searchParams;
  if (state.edit && !z.uuid().safeParse(state.edit).success) notFound();
  const service = new ResearchOutputService();
  const [items, current] = await Promise.all([service.list(result.access), state.edit ? service.get(result.access, state.edit) : Promise.resolve(null)]);
  if (state.edit && !current) notFound();
  const input = current?.versions[0]?.input;
  const [uploads, options, selected] = await Promise.all([service.uploads(result.access, input?.files.map(f => f.id)),
    service.workOptions(result.access), input?.workIds.length ? service.workOptions(result.access, "", input.workIds) : Promise.resolve([])]);
  const works = [...new Map([...options, ...selected].map(w => [w.id, w])).values()];
  return <div className="content-page"><div className="media-detail-heading"><div><p className="page-kicker">Наука</p><h1>Научные результаты</h1><p>Данные, отчёты, карты и инструменты исследований.</p></div><Link href="/admin/science/results">Новый результат</Link></div>
    {state.saved ? <p className="notice success-notice">Новая версия сохранена.</p> : null}
    {state.error ? <p role="alert" className="notice error-notice">{state.error === "stale_version" ? "Результат уже изменён. Обновите страницу перед сохранением." : "Не удалось сохранить. Проверьте поля, права на работы и доступность файлов."}</p> : null}
    <form action={saveResearchOutput} className="article-form" key={`${current?.id ?? "new"}:${current?.version ?? 0}`}>
      <section className="article-editor-panel"><h2>{current ? `Редактирование · версия ${current.version}` : "Новый результат"}</h2>
        <p className="field-hint">Владелец — создатель записи. Каждое сохранение добавляет версию; прошлые версии доступны владельцу и менеджерам.</p>
        {current ? <><input type="hidden" name="id" value={current.id} /><input type="hidden" name="expectedVersion" value={current.version} /></> : null}
        <div className="form-three-columns"><label>Тип<select name="kind" defaultValue={input?.kind ?? "dataset"}>{researchOutputKinds.map(k => <option key={k} value={k}>{researchOutputLabels.ru[k]}</option>)}</select></label>
          <label>Обозначение версии<input name="versionLabel" required maxLength={80} defaultValue={input?.versionLabel ?? "1.0"} /></label>
          <label>Статус<select name="status" defaultValue={input?.status ?? "draft"}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label></div>
        <label>Лицензия / условия использования<input name="license" required maxLength={160} defaultValue={input?.license ?? ""} /></label>
        <label>Внешняя ссылка<input name="externalUrl" type="url" maxLength={1000} defaultValue={input?.externalUrl ?? ""} /></label>
        <label>Что изменилось<textarea name="changeNote" maxLength={2000} defaultValue="" /></label>
      </section>
      {(["ru", "kk", "en"] as const).map(locale => <section className="article-editor-panel" key={locale}><h2>{locale.toUpperCase()}{locale === "en" ? " · необязательно" : ""}</h2>
        <label>Название<input name={`${locale}.title`} required={locale !== "en"} minLength={3} maxLength={240} defaultValue={input?.[locale]?.title ?? ""} /></label>
        <label>Описание<textarea name={`${locale}.description`} required={locale !== "en"} minLength={20} maxLength={20000} rows={5} defaultValue={input?.[locale]?.description ?? ""} /></label>
      </section>)}
      <ResearchOutputAttachments initialFiles={input?.files ?? []} initialWorkIds={input?.workIds ?? []} initialWorks={works} initialUploads={uploads} />
    </form>
    {current ? <section className="article-editor-panel"><h2>История версий</h2>{current.versions.map(v => <details key={v.version}><summary>Версия {v.version} · {v.input.versionLabel} · {new Date(v.createdAt).toISOString()}</summary><p>{v.input.changeNote || "Без комментария"}</p><h3>{v.input.ru.title}</h3><p>{v.input.ru.description}</p><p>{v.input.license}</p><ul>{v.input.files.map(f => <li key={f.id}><a href={`/api/results/${current.id}/files/${f.id}?version=${v.version}`}>Скачать {uploads.find(u => u.id === f.id)?.file_name ?? "файл версии"}</a> · {f.isPublic ? "Публичный" : "Закрытый"}</li>)}</ul></details>)}</section> : null}
    <section className="article-editor-panel"><h2>Последние результаты</h2><ul className="relation-options">{items.map(item => <li key={item.id}><Link href={`?edit=${item.id}`}>{item.input.ru.title}</Link><span>{researchOutputLabels.ru[item.input.kind]} · {item.input.status} · версия {item.version}</span></li>)}</ul></section>
  </div>;
}
