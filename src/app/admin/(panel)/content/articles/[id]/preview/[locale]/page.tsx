import { ArticleCredits } from "@/components/articles/ArticleCredits";
import { articleTypeLabel } from "@/lib/articles/presentation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { RichTextContent } from "@/components/articles/RichTextContent";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getArticleImages } from "@/server/repositories/article-images.repository";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";

export const metadata: Metadata = { title: "Предпросмотр статьи", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ArticlePreviewPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params;
  if (!z.uuid().safeParse(id).success || (locale !== "ru" && locale !== "kk")) notFound();
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") notFound();
  const article = await new ArticleService().getPreview(result.access, id);
  if (!article) notFound();
  const translation = article.translations.find(item => item.locale === locale);
  if (!translation) notFound();
  const client = await createServerSupabaseClient();
  const images = await getArticleImages(client, translation.contentJson, locale);
  const coverImages = article.coverMediaId ? await getArticleImages(client, { type: "image", attrs: { mediaId: article.coverMediaId } }, locale) : [];
  return <div className="content-page" lang={locale}>
    <div className="notice">Предпросмотр · {locale.toUpperCase()} · версия {article.contentVersion} · последний сохранённый текст</div>
    <div className="preview-links">
      <Link href={`/admin/content/articles/${id}`}>Вернуться в редактор</Link>
      <Link href={`/admin/content/articles/${id}/preview/${locale === "ru" ? "kk" : "ru"}`}>{locale === "ru" ? "Қазақша нұсқа" : "Русская версия"}</Link>
    </div>
    <article className="public-article">
      <header className="public-article-header"><p>{articleTypeLabel(article.contentType, article.contentTypeItem, locale)} · {article.categories.map(item => locale === "ru" ? item.nameRu : item.nameKk).join(", ")}</p><h1>{translation.title}</h1><p className="public-article-lead">{translation.excerpt}</p></header>
      {coverImages[0] ? <figure className="public-article-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverImages[0].url} alt={coverImages[0].alt} />
        {coverImages[0].caption ? <figcaption>{coverImages[0].caption}</figcaption> : null}
      </figure> : null}
      <ArticleCredits authors={article.authors} locale={locale} detailed /><div className="public-article-body"><RichTextContent content={translation.contentJson} body={translation.body} images={images} /></div>
    </article>
  </div>;
}
