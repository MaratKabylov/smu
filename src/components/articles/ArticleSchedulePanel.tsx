import { SubmitButton } from "@/components/science/SubmitButton";
import { editorialTimeZoneLabel, scheduleDisplayValue, scheduleInputValue } from "@/lib/articles/scheduling";
import { scheduleArticle } from "@/server/actions/article.actions";
import type { Article } from "@/types/domain/article";

export function ArticleSchedulePanel({ article, mayPublish }: { article: Article; mayPublish: boolean }) {
  if (article.status !== "approved" && article.status !== "scheduled") return null;
  const action = scheduleArticle.bind(null, article.id, article.contentVersion, article.scheduledAt);
  return <section className="article-schedule-panel" aria-labelledby="article-schedule-title">
    <div>
      <p className="page-kicker">Публикация по расписанию</p>
      <h2 id="article-schedule-title">{article.scheduledAt ? "Публикация запланирована" : "Выбрать время публикации"}</h2>
      {article.scheduledAt ? <p><strong>{scheduleDisplayValue(article.scheduledAt)}</strong> · {editorialTimeZoneLabel}</p> : null}
      <p>Статья появится после наступления выбранного времени и выполнения автоматической публикации. Правки текста отменят расписание и потребуют повторного одобрения.</p>
    </div>
    {mayPublish ? <div className="schedule-forms">
      <form action={action}>
        <label>Дата и время · {editorialTimeZoneLabel}
          <input type="datetime-local" name="scheduledAt" step="60" required
            defaultValue={article.scheduledAt ? scheduleInputValue(article.scheduledAt) : ""} />
        </label>
        <SubmitButton label={article.scheduledAt ? "Перенести публикацию" : "Запланировать публикацию"} />
      </form>
      {article.scheduledAt ? <form action={action}>
        <input type="hidden" name="intent" value="cancel" />
        <SubmitButton label="Отменить расписание" />
        <p className="field-hint">Статья останется одобренной.</p>
      </form> : null}
    </div> : null}
  </section>;
}
