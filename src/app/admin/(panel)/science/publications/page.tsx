import { PublicationRelationsEditor } from "@/components/science/PublicationRelationsEditor";
import Link from "next/link";
import { z } from "zod";
import { PublicationScientistSelect } from "@/components/science/PublicationScientistSelect";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions/permissions";
import { getAdminAccess } from "@/server/services/access.service";
import { PublicationService } from "@/server/services/publication.service";
import { ArticleRelationsService } from "@/server/services/article-relations.service";
import { savePublication } from "@/server/actions/publication.actions";
import { publicationTypes, publicationTypeLabels } from "@/types/domain/publication";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string; error?: string }> }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!hasPermission(result.access, "publications.manage")) notFound();
  const [state, publications, scientists] = await Promise.all([searchParams, new PublicationService().list(result.access), new ArticleRelationsService().search(result.access, "scientist")]);
  if (state.edit && !z.uuid().safeParse(state.edit).success) notFound();
  const current = state.edit ? await new PublicationService().getById(result.access, state.edit) : null;
  if (state.edit && !current) notFound();
  const selectedScientist = current && !scientists.some(item => item.entityId === current.scientistId)
    ? (await new ArticleRelationsService().search(result.access, "scientist", "", [current.scientistId]))[0] : undefined;
  const options = selectedScientist ? [...scientists, selectedScientist] : scientists;
  const relations = new ArticleRelationsService();
  const coauthorIds = current?.coauthors.flatMap(a => a.scientistId ? [a.scientistId] : []) ?? [];
  const [coauthorOptions, researchOptions, projectOptions] = await Promise.all([
    coauthorIds.length ? relations.search(result.access, "scientist", "", coauthorIds) : Promise.resolve([]),
    relations.search(result.access, "research"), relations.search(result.access, "project"),
  ]);
  const selectedWorks = current?.workIds.length ? (await Promise.all([
    relations.search(result.access, "research", "", current.workIds),
    relations.search(result.access, "project", "", current.workIds),
  ])).flat() : [];
  const authorOptions = [...new Map([...options, ...coauthorOptions].map(o => [o.entityId, o])).values()];
  const workOptions = [...new Map([...researchOptions, ...projectOptions, ...selectedWorks].map(o => [o.entityId, o])).values()];
  return <div className="content-page"><div className="media-detail-heading"><div><p className="page-kicker">Наука</p><h1>Научные публикации</h1><p>Публикации в научных журналах, книгах и материалах конференций.</p></div><Link href="/admin/science/publications">Добавить публикацию</Link></div>
    {state.saved ? <p className="notice success-notice">Публикация сохранена.</p> : null}
    {state.error ? <p className="notice error-notice" role="alert">{state.error === "stale_version" ? "Запись изменена в другой вкладке. Обновите страницу." : "Не удалось сохранить. Проверьте поля, повторы авторов и доступность связанных профилей и работ."}</p> : null}
    <form className="article-form" action={savePublication} key={current?.updatedAt ?? "new"}><section className="article-editor-panel"><h2>{current ? "Редактировать публикацию" : "Новая публикация"}</h2>
      {current ? <><input type="hidden" name="id" value={current.id} /><input type="hidden" name="expectedUpdatedAt" value={current.updatedAt} /></> : null}
      <label>Название в оригинале<input name="title" minLength={3} maxLength={500} required defaultValue={current?.title} /></label>
      <p className="field-hint">Указывается библиографическое название на языке оригинала.</p>
      <div className="form-three-columns"><PublicationScientistSelect options={options} initialId={current?.scientistId} /><label>Год<input name="year" type="number" min={1800} max={2200} required defaultValue={current?.year ?? new Date().getFullYear()} /></label><label>Тип<select name="publicationType" defaultValue={current?.publicationType ?? "article"}>{publicationTypes.map(type => <option value={type} key={type}>{publicationTypeLabels.ru[type]}</option>)}</select></label></div>
      <label>Журнал / издание<input name="journal" minLength={2} maxLength={240} required defaultValue={current?.journal} /></label>
      <div className="form-three-columns"><label>DOI<input name="doi" maxLength={300} placeholder="10.1234/example" defaultValue={current?.doi ?? ""} /></label><label>Ссылка на публикацию<input name="url" type="url" maxLength={1000} defaultValue={current?.url ?? ""} /></label><label>Статус<select name="status" defaultValue={current?.status ?? "draft"}><option value="draft">Черновик</option><option value="published">Опубликована</option><option value="archived">Архив</option></select></label></div>
      <PublicationRelationsEditor scientists={authorOptions} works={workOptions} coauthors={current?.coauthors} workIds={current?.workIds} />
      <button className="primary-button" type="submit">Сохранить публикацию</button>
    </section></form>
    <section className="article-editor-panel"><h2>Последние публикации</h2><ul className="relation-options">{publications.map(item => <li key={item.id}><Link href={`?edit=${item.id}`}>{item.title}</Link><span>{item.year} · {item.journal} · {item.status}</span></li>)}</ul></section>
  </div>;
}
