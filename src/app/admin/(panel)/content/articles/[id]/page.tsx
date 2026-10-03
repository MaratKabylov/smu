import { ArrowLeft, Archive, CheckCircle2, Send, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/articles/ArticleForm";
import { articleStatusLabels } from "@/lib/articles/presentation";
import {
  canDeleteArticle,
  canEditArticle,
  canPublishArticle,
  canReviewArticle,
  canViewMedia,
  hasPermission,
} from "@/lib/permissions/permissions";
import {
  changeArticleStatus,
  assignArticleReviewer,
  softDeleteArticle,
  updateArticle,
} from "@/server/actions/article.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";
import { MediaService } from "@/server/services/media.service";
import type { ArticleStatus } from "@/types/domain/article";

type ArticleDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    saved?: string;
    status_changed?: string;
    reviewer_saved?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  validation: "Проверьте обязательные поля, длину текстов и формат slug.",
  forbidden: "Недостаточно прав для этого действия.",
  invalid_transition: "Этот переход редакционного статуса недоступен.",
  invalid_reference: "Выбранная категория, тег или обложка недоступны.",
  confirm_delete: "Подтвердите перенос статьи в удалённые.",
  action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug.",
  invalid_input: "Проверьте обязательные поля материала.",
  slug_conflict: "Этот slug уже используется. Выберите другой адрес.",
  slug_reserved: "Этот адрес принадлежит другому материалу и сохранён в истории ссылок.",
  stale_version: "Материал изменился после открытия страницы. Проверьте актуальный текст перед изменением статуса.",
};

export default async function ArticleDetailPage({ params, searchParams }: ArticleDetailPageProps) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;

  const [{ id }, state] = await Promise.all([params, searchParams]);
  const service = new ArticleService();
  const article = await service.getById(result.access, id);
  if (!article || article.deletedAt) notFound();

  const [taxonomy, initialMedia] = await Promise.all([
    service.listTaxonomy(result.access),
    canViewMedia(result.access)
      ? new MediaService()
          .list(result.access, { query: "", type: "image" })
          .then((assets) =>
            assets.filter((asset) => asset.storageBucket === "article-media"),
          )
      : Promise.resolve([]),
  ]);
  const media = [...initialMedia];
  if (
    article.coverMediaId &&
    canViewMedia(result.access) &&
    !media.some((asset) => asset.id === article.coverMediaId)
  ) {
    const currentCover = await new MediaService().getById(
      result.access,
      article.coverMediaId,
    );
    if (currentCover && !currentCover.asset.deletedAt) {
      media.push(currentCover.asset);
    }
  }
  const canPublish = canPublishArticle(result.access);
  const mayEdit =
    canEditArticle(result.access, article.authorId) &&
    (article.status === "draft" || hasPermission(result.access, "articles.edit_any")) &&
    (article.status !== "archived" || canPublish);
  const mayReview = canReviewArticle(result.access, article.scientificReviewerId);
  const mayAssignReviewer = hasPermission(result.access, "articles.edit_any") || canPublish;
  const reviewers = mayAssignReviewer ? await service.listReviewers(result.access) : [];
  const mayDelete = canDeleteArticle(result.access);
  const updateAction = updateArticle.bind(null, article.id);
  const deleteAction = softDeleteArticle.bind(null, article.id);
  const ru = article.translations.find((translation) => translation.locale === "ru");

  return (
    <div className="content-page">
      <Link className="back-link" href="/admin/content/articles">
        <ArrowLeft aria-hidden="true" />Назад к статьям
      </Link>
      <div className="media-detail-heading article-detail-heading">
        <div>
          <p className="page-kicker">Редактор материала</p>
          <h1>{ru?.title ?? "Статья"}</h1>
          <p>{article.authorName ?? "Автор не указан"} · {articleStatusLabels[article.status]}</p>
        </div>
        <span className={`status-badge status-${article.status}`}>{articleStatusLabels[article.status]}</span>
      </div>

      {state.created === "1" ? <div className="notice success-notice">Черновик создан.</div> : null}
      {state.saved === "1" ? <div className="notice success-notice">Изменения сохранены.</div> : null}
      {state.status_changed === "1" ? <div className="notice success-notice">Редакционный статус обновлён.</div> : null}
      {state.reviewer_saved === "1" ? <div className="notice success-notice">Назначение рецензента сохранено.</div> : null}
      {state.error ? <div className="notice error-notice" role="alert">{errorMessages[state.error] ?? errorMessages.action_failed}</div> : null}

      <section className="workflow-panel">
        <div>
          <p className="page-kicker">Редакционный процесс</p>
          <h2>{articleStatusLabels[article.status]}</h2>
          <p>Переходы доступны в соответствии с ролью пользователя.</p>
        </div>
        <div className="workflow-actions">
          <WorkflowActions
            articleId={article.id}
            status={article.status}
            contentVersion={article.contentVersion}
            mayEdit={mayEdit}
            mayReview={mayReview}
            mayPublish={canPublish}
          />
        </div>
      </section>

      {mayAssignReviewer && (article.status === "draft" || article.status === "in_review") ? (
        <section className="workflow-panel">
          <div><h2>Научный рецензент</h2><p>Рецензент получает доступ к назначенному материалу.</p></div>
          <form action={assignArticleReviewer.bind(null, article.id)}>
            <label>Рецензент
              <select name="reviewerId" defaultValue={article.scientificReviewerId ?? ""}>
                <option value="">Не назначен</option>
                {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.displayName}</option>)}
              </select>
            </label>
            <button className="secondary-button" type="submit">Сохранить назначение</button>
          </form>
        </section>
      ) : null}
      {mayEdit && article.status !== "draft" ? (
        <div className="notice">Сохранение изменений вернёт материал в черновики. Перед публикацией потребуется повторное одобрение.</div>
      ) : null}
      <ArticleForm action={updateAction} article={article} taxonomy={taxonomy} media={media} disabled={!mayEdit} canPreview={canEditArticle(result.access, article.authorId) || mayReview || canPublish} />

      {mayDelete ? (
        <section className="danger-zone">
          <div>
            <h2>Перенести в удалённые</h2>
            <p>Статья исчезнет из редакционного списка и публичного доступа.</p>
          </div>
          <form action={deleteAction}>
            <label className="confirm-check">
              <input type="checkbox" name="confirm" value="yes" required />Подтверждаю действие
            </label>
            <button className="danger-button" type="submit"><Trash2 aria-hidden="true" />Удалить</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function WorkflowActions({
  articleId,
  status,
  contentVersion,
  mayEdit,
  mayReview,
  mayPublish,
}: {
  articleId: string;
  status: ArticleStatus;
  contentVersion: number;
  mayEdit: boolean;
  mayReview: boolean;
  mayPublish: boolean;
}) {
  const actions: Array<{
    next: ArticleStatus;
    label: string;
    icon: typeof Send;
    primary?: boolean;
  }> = [];

  if (status === "draft" && mayEdit) actions.push({ next: "in_review", label: "Отправить на рецензию", icon: Send, primary: true });
  if (status === "in_review" && (mayReview || mayEdit)) actions.push({ next: "draft", label: "Вернуть в черновики", icon: Undo2 });
  if (status === "in_review" && mayReview) actions.push({ next: "approved", label: "Одобрить", icon: CheckCircle2, primary: true });
  if (status === "approved" && (mayReview || mayPublish)) actions.push({ next: "draft", label: "Вернуть на доработку", icon: Undo2 });
  if (status === "approved" && mayPublish) actions.push({ next: "published", label: "Опубликовать", icon: Send, primary: true });
  if (status === "published" && mayPublish) actions.push({ next: "archived", label: "Перенести в архив", icon: Archive });
  if (status === "published" && mayPublish) actions.push({ next: "draft", label: "Снять с публикации", icon: Undo2 });
  if (status === "archived" && mayPublish) actions.push({ next: "draft", label: "Вернуть в черновики", icon: Undo2 });

  if (actions.length === 0) return <span className="field-hint">Нет доступных действий</span>;

  return actions.map(({ next, label, icon: Icon, primary }) => {
    const action = changeArticleStatus.bind(null, articleId, next, contentVersion);
    return (
      <form action={action} key={next}>
        <button className={primary ? "primary-button" : "secondary-button"} type="submit">
          <Icon aria-hidden="true" />{label}
        </button>
      </form>
    );
  });
}
