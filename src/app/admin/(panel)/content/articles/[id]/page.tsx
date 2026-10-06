import { ArrowLeft, Archive, CheckCircle2, Send, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/articles/ArticleForm";
import { ArticleSchedulePanel } from "@/components/articles/ArticleSchedulePanel";
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
  configureArticleReview,
  softDeleteArticle,
  submitArticleReview,
  updateArticle,
} from "@/server/actions/article.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService } from "@/server/services/article.service";
import { canReadArticleRevisions } from "@/server/services/article-revision.service";
import { MediaService } from "@/server/services/media.service";
import type { ArticleStatus } from "@/types/domain/article";

type ArticleDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    saved?: string;
    status_changed?: string;
    reviewer_saved?: string;
    review_saved?: string;
    schedule_saved?: string;
    restored?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  validation: "Проверьте обязательные поля, длину текстов и формат slug.",
  forbidden: "Недостаточно прав для этого действия.",
  invalid_transition: "Этот переход редакционного статуса недоступен.",
  invalid_reference: "Выбранные авторы, тип, категории, теги или файлы недоступны.",
  confirm_delete: "Подтвердите перенос статьи в удалённые.",
  action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug.",
  invalid_input: "Проверьте обязательные поля. Время отложенной публикации должно быть в будущем.",
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
    service.listTaxonomy(result.access, true),
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
  const canEdit = canEditArticle(result.access, article.authorId);
  const mayEdit =
    canEdit &&
    (article.status === "draft" || hasPermission(result.access, "articles.edit_any")) &&
    (article.status !== "archived" || canPublish);
  const mayReview = canReviewArticle(result.access, article.scientificReviewerId);
  const mayDecideReview = mayReview &&
    (!article.requiresScientificReview || article.scientificReviewerId === result.access.userId);
  const mayAssignReviewer = hasPermission(result.access, "articles.edit_any") || canPublish;
  const reviewers = mayAssignReviewer ? await service.listReviewers(result.access) : [];
  const reviews = canEdit || mayReview || canPublish
    ? await service.listReviews(result.access, article.id)
    : [];
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
      {state.restored === "1" ? <div className="notice success-notice">Версия восстановлена. Статья возвращена в черновики; перед публикацией нужно повторное одобрение.</div> : null}
      {state.review_saved === "1" ? <div className="notice success-notice">Решение рецензента сохранено для текущей версии.</div> : null}
      {state.schedule_saved === "1" ? <div className="notice success-notice">Расписание публикации обновлено.</div> : null}
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
            mayEdit={canEdit}
            mayReview={mayReview}
            mayPublish={canPublish}
            canEnterReview={!article.requiresScientificReview || Boolean(article.scientificReviewerId)}
          />
        </div>
      </section>

      <ArticleSchedulePanel article={article} mayPublish={canPublish} />

      {canReadArticleRevisions(result.access, article) ? <div className="preview-links">
        <Link href={`/admin/content/articles/${article.id}/revisions`}>История версий и сравнение</Link>
      </div> : null}

      {mayAssignReviewer && (["draft", "in_review", "changes_requested"] as ArticleStatus[]).includes(article.status) ? (
        <section className="workflow-panel">
          <div><h2>Научный рецензент</h2><p>Рецензент получает доступ к назначенному материалу.</p></div>
          <form action={configureArticleReview.bind(null, article.id)}>
            <label className="confirm-check">
              <input name="requiresScientificReview" type="checkbox" value="yes" defaultChecked={article.requiresScientificReview} />
              Обязательная научная рецензия
            </label>
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
      {article.status === "in_review" && mayDecideReview ? (
        <section className="review-decision-panel">
          <div>
            <p className="page-kicker">Версия {article.contentVersion}</p>
            <h2>Решение по рецензии</h2>
            <p>Комментарий и решение сохранятся в истории именно этой версии материала.</p>
          </div>
          <form action={submitArticleReview.bind(null, article.id, article.contentVersion)}>
            <label>Комментарий рецензента
              <textarea name="comment" minLength={3} maxLength={5000} rows={5} required />
            </label>
            <div className="workflow-actions">
              <button className="secondary-button" type="submit" name="decision" value="changes_requested"><Undo2 aria-hidden="true" />Запросить изменения</button>
              <button className="primary-button" type="submit" name="decision" value="approved"><CheckCircle2 aria-hidden="true" />Одобрить версию</button>
            </div>
          </form>
        </section>
      ) : null}
      {reviews.length > 0 ? (
        <section className="review-history" aria-labelledby="review-history-title">
          <div><p className="page-kicker">История решений</p><h2 id="review-history-title">Научные рецензии</h2></div>
          <ol>
            {reviews.map(review => <li key={review.id}>
              <div><strong>{review.decision === "approved" ? "Одобрено" : "Запрошены изменения"}</strong><span>Версия {review.contentVersion} · {review.reviewerName} · {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.createdAt))}</span></div>
              <p>{review.comment}</p>
            </li>)}
          </ol>
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
  canEnterReview,
}: {
  articleId: string;
  status: ArticleStatus;
  contentVersion: number;
  mayEdit: boolean;
  mayReview: boolean;
  mayPublish: boolean;
  canEnterReview: boolean;
}) {
  const actions: Array<{
    next: ArticleStatus;
    label: string;
    icon: typeof Send;
    primary?: boolean;
  }> = [];

  if (status === "draft" && mayEdit && canEnterReview) actions.push({ next: "in_review", label: "Отправить на рецензию", icon: Send, primary: true });
  if (status === "changes_requested" && mayEdit) actions.push({ next: "draft", label: "Перейти к доработке", icon: Undo2, primary: true });
  if (status === "in_review" && (mayReview || mayEdit)) actions.push({ next: "draft", label: "Вернуть в черновики", icon: Undo2 });
  if (status === "approved" && (mayReview || mayPublish)) actions.push({ next: "draft", label: "Вернуть на доработку", icon: Undo2 });
  if (status === "approved" && mayPublish) actions.push({ next: "published", label: "Опубликовать", icon: Send, primary: true });
  if (status === "scheduled" && mayPublish) actions.push({ next: "published", label: "Опубликовать сейчас", icon: Send, primary: true });
  if (status === "scheduled" && mayPublish) actions.push({ next: "draft", label: "Вернуть на доработку", icon: Undo2 });
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
