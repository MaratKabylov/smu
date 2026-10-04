import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { RichTextContent } from "@/components/articles/RichTextContent";
import { articleSnapshot, revisionReasonLabels, snapshotComparison } from "@/lib/articles/revisions";
import { articleContentTypeLabels } from "@/lib/articles/presentation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createArticleRevision, restoreArticleRevision } from "@/server/actions/article-revision.actions";
import { getArticleImages } from "@/server/repositories/article-images.repository";
import { ArticleRepository } from "@/server/repositories/article.repository";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";
import { ArticleRevisionService, canManageArticleRevisions, canReadArticleRevisions } from "@/server/services/article-revision.service";
import type { ArticleContentType, ArticleSnapshot } from "@/types/domain/article";

export const metadata: Metadata = { title: "История версий статьи", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const querySchema = z.object({
  revision: z.uuid().optional(), compare: z.union([z.literal("current"), z.uuid()]).default("current"),
  locale: z.enum(["ru", "kk"]).default("ru"), page: z.coerce.number().int().min(1).max(100000).default(1),
  created: z.string().optional(), error: z.string().optional(),
});
const errors: Record<string, string> = {
  forbidden: "Недостаточно прав для этого действия.", not_found: "Версия или статья недоступна.",
  stale_version: "Материал изменился после открытия страницы. Обновите страницу и сравните версии ещё раз.",
  invalid_reference: "Категория, тег или изображение этой версии недоступны. Восстановление отменено.",
  invalid_input: "Содержимое версии не прошло проверку. Восстановление отменено.",
  slug_conflict: "Адрес этой версии уже занят другим материалом. Восстановление отменено.",
  slug_reserved: "Адрес этой версии зарезервирован другим материалом. Восстановление отменено.",
  confirm_restore: "Подтвердите восстановление версии.",
  action_failed: "Не удалось выполнить действие с версией. Попробуйте ещё раз.",
};

export default async function ArticleRevisionsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, rawQuery] = await Promise.all([params, searchParams]);
  const query = querySchema.safeParse(rawQuery);
  if (!z.uuid().safeParse(id).success || !query.success) notFound();
  const state = query.data;
  const accessResult = await getAdminAccess();
  if (accessResult.state === "unauthenticated") redirect("/admin/login");
  if (accessResult.state !== "allowed") notFound();
  const access = accessResult.access;
  const article = await new ArticleService().getById(access, id);
  if (!article || !canReadArticleRevisions(access, article)) notFound();
  const service = new ArticleRevisionService();
  const history = await service.list(access, id, state.page);
  const selectedId = state.revision ?? history.revisions[0]?.id;
  const [selected, comparison] = await Promise.all([
    selectedId ? service.get(access, id, selectedId) : Promise.resolve(null),
    state.compare === "current" ? Promise.resolve(null) : service.get(access, id, state.compare),
  ]);
  if ((selectedId && !selected) || (state.compare !== "current" && !comparison)) notFound();
  const complete = ["ru", "kk"].every(locale => article.translations.some(item => item.locale === locale));
  const mayManage = complete && canManageArticleRevisions(access, article);
  const current = articleSnapshot(article);
  const right = comparison?.snapshot ?? current;
  const fields = selected ? snapshotComparison(selected.snapshot, right, state.locale) : [];
  const changes = fields.filter(field => field.changed);
  const client = await createServerSupabaseClient();
  const images = selected ? await Promise.all([
    getArticleImages(client, selected.snapshot[state.locale].contentJson, state.locale),
    getArticleImages(client, right[state.locale].contentJson, state.locale),
  ]) : [[], []];
  const covers = selected ? await Promise.all([
    getArticleImages(client, selected.snapshot.coverMediaId ? { type: "image", attrs: { mediaId: selected.snapshot.coverMediaId } } : null, state.locale),
    getArticleImages(client, right.coverMediaId ? { type: "image", attrs: { mediaId: right.coverMediaId } } : null, state.locale),
  ]) : [[], []];
  const taxonomy = await new ArticleRepository(client).listTaxonomy(true);
  function displayField(label: string, value: string, snapshot: ArticleSnapshot) {
    const nameKey = state.locale === "ru" ? "nameRu" : "nameKk";
    if (label === "Тип материала") return articleContentTypeLabels[value as ArticleContentType] ?? value;
    if (label === "Категория") return snapshot.categoryId
      ? taxonomy.categories.find(item => item.id === snapshot.categoryId)?.[nameKey] ?? "Недоступная категория" : "—";
    if (label === "Теги") return snapshot.tagIds.length
      ? snapshot.tagIds.map(id => taxonomy.tags.find(item => item.id === id)?.[nameKey] ?? "Недоступный тег").join(", ") : "—";
    return value;
  }
  function href(values: { revision?: string; compare?: string; locale?: string; page?: number }) {
    const search = new URLSearchParams({ locale: state.locale, page: String(state.page), compare: state.compare });
    if (selectedId) search.set("revision", selectedId);
    for (const [key, value] of Object.entries(values)) if (value !== undefined) search.set(key, String(value));
    return `/admin/content/articles/${id}/revisions?${search}`;
  }
  return <div className="content-page revision-page">
    <Link className="back-link" href={`/admin/content/articles/${id}`}>Вернуться в редактор</Link>
    <div className="media-detail-heading">
      <div><p className="page-kicker">История версий</p><h1>{current.ru.title || current.kk.title || "Статья"}</h1>
        <p>Сохраняются обе языковые версии, адреса, SEO, категория, теги и обложка.</p></div>
      {mayManage ? <form action={createArticleRevision.bind(null, id, article.contentVersion)}>
        <button className="primary-button" type="submit">Создать версию</button>
      </form> : null}
    </div>
    {state.created === "1" ? <div className="notice success-notice">Версия сохранена.</div> : null}
    {state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? errors.action_failed}</div> : null}
    {!complete ? <div className="notice">Для создания или восстановления версии сначала заполните и сохраните обе языковые версии в редакторе.</div> : null}
    <div className="notice">Версия создаётся при отправке на рецензию, публикации и вручную. Автосохранение обновляет только текущий материал.</div>
    <section className="article-editor-panel">
      <h2>Сохранённые версии · {history.total}</h2>
      {history.revisions.length ? <ol className="revision-list">
        {history.revisions.map(revision => <li key={revision.id}>
          <Link href={href({ revision: revision.id })} aria-current={selectedId === revision.id ? "page" : undefined}>
            <strong>№{revision.revisionNumber} · {revisionReasonLabels[revision.reason]}</strong>
            <span>{new Date(revision.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Aqtobe" })} · содержимое v{revision.contentVersion}</span>
            <span>{revision.createdByName ?? (revision.createdBy ? "Пользователь редакции" : "Удалённый пользователь")}</span>
            <span>{state.locale === "ru" ? revision.titleRu : revision.titleKk}</span>
          </Link>
          <Link href={href({ compare: revision.id })}>Сравнить с этой версией</Link>
        </li>)}
      </ol> : <p>На этой странице пока нет сохранённых версий.</p>}
      <nav className="preview-links" aria-label="Страницы истории">
        {state.page > 1 ? <Link href={href({ page: state.page - 1 })}>Предыдущая страница</Link> : null}
        {state.page * 20 < history.total ? <Link href={href({ page: state.page + 1 })}>Следующая страница</Link> : null}
      </nav>
    </section>
    {selected ? <>
      <section className="article-editor-panel">
        <h2>Версия №{selected.revisionNumber} и {comparison ? `версия №${comparison.revisionNumber}` : `текущий материал v${article.contentVersion}`}</h2>
        <nav className="preview-links" aria-label="Язык сравнения">
          <Link href={href({ locale: "ru" })} aria-current={state.locale === "ru" ? "page" : undefined}>Русский</Link>
          <Link href={href({ locale: "kk" })} aria-current={state.locale === "kk" ? "page" : undefined}>Қазақша</Link>
          <Link href={href({ compare: "current" })}>Сравнить с текущим материалом</Link>
        </nav>
        <p>{changes.length ? `Изменённых полей: ${changes.length}.` : "Содержимое совпадает."}</p>
        <div className="revision-table-scroll">
          <table className="revision-comparison" lang={state.locale}>
            <caption>Сравнение полей {state.locale.toUpperCase()}</caption>
            <thead><tr><th scope="col">Поле</th><th scope="col">Версия №{selected.revisionNumber}</th><th scope="col">{comparison ? `Версия №${comparison.revisionNumber}` : "Текущий материал"}</th></tr></thead>
            <tbody>{fields.map(field => <tr key={field.label} className={field.changed ? "revision-changed" : undefined}>
              <th scope="row">{field.label}{field.changed ? <span>Изменено</span> : null}</th>
              {[field.leftText, field.rightText].map((value, index) => <td key={index}>{field.structured
                ? <span>{field.changed ? "Отличается. См. предпросмотр ниже." : "Совпадает."}</span>
                : field.label === "Обложка" ? covers[index][0]
                  ? <figure className="revision-cover">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={covers[index][0].url} alt={covers[index][0].alt} />
                    {covers[index][0].caption ? <figcaption>{covers[index][0].caption}</figcaption> : null}
                  </figure>
                  : <span>{(index === 0 ? selected.snapshot : right).coverMediaId ? "Недоступное изображение" : "—"}</span>
                : <div className="revision-value">{displayField(field.label, value, index === 0 ? selected.snapshot : right)}</div>}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="revision-previews" lang={state.locale}>
          <section><h3>Версия №{selected.revisionNumber}</h3><RichTextContent content={selected.snapshot[state.locale].contentJson} body={selected.snapshot[state.locale].body} images={images[0]} /></section>
          <section><h3>{comparison ? `Версия №${comparison.revisionNumber}` : "Текущий материал"}</h3><RichTextContent content={right[state.locale].contentJson} body={right[state.locale].body} images={images[1]} /></section>
        </div>
      </section>
      {mayManage ? <section className="workflow-panel">
        <div><h2>Восстановить версию №{selected.revisionNumber}</h2>
          <p>Обе языковые версии заменят текущий материал. Статья вернётся в черновики и потребует повторного одобрения. Текущий текст будет сохранён отдельной версией.</p></div>
        <form action={restoreArticleRevision.bind(null, id, selected.id, article.contentVersion)}>
          <label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю восстановление обеих языковых версий</label>
          <button className="secondary-button" type="submit">Восстановить в черновик</button>
        </form>
      </section> : null}
    </> : null}
  </div>;
}
