import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/articles/ArticleForm";
import { canCreateArticle, canViewMedia } from "@/lib/permissions/permissions";
import { createArticle } from "@/server/actions/article.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";
import { MediaService } from "@/server/services/media.service";

type NewArticlePageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewArticlePage({ searchParams }: NewArticlePageProps) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canCreateArticle(result.access)) notFound();

  const [taxonomy, media, state] = await Promise.all([
    new ArticleService().listTaxonomy(result.access),
    canViewMedia(result.access)
      ? new MediaService().list(result.access, { query: "", type: "image" })
      : Promise.resolve([]),
    searchParams,
  ]);

  return (
    <div className="content-page">
      <Link className="back-link" href="/admin/content/articles">
        <ArrowLeft aria-hidden="true" />Назад к статьям
      </Link>
      <div className="media-detail-heading">
        <div>
          <p className="page-kicker">Новый материал</p>
          <h1>Создать статью</h1>
          <p>Новая статья будет сохранена как черновик.</p>
        </div>
      </div>
      {state.error ? (
        <div className="notice error-notice" role="alert">
          {state.error === "validation"
            ? "Проверьте обязательные поля, длину текстов и формат slug."
            : "Не удалось создать статью. Проверьте уникальность slug."}
        </div>
      ) : null}
      <ArticleForm action={createArticle} taxonomy={taxonomy} media={media} submitLabel="Создать черновик" />
    </div>
  );
}
