import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Article } from "@/types/domain/article";
vi.mock("@/server/actions/article.actions", () => ({ scheduleArticle: vi.fn() }));
import { ArticleSchedulePanel } from "./ArticleSchedulePanel";

const article = { id: "article", contentVersion: 3, status: "scheduled", scheduledAt: "2026-10-06T19:15:00Z" } as Article;
describe("article scheduling controls", () => {
  it("shows the explicit timezone and current time with separate reschedule and cancel forms", () => {
    const html = renderToStaticMarkup(<ArticleSchedulePanel article={article} mayPublish />);
    expect(html).toContain("Время Казахстана (UTC+5)");
    expect(html).toContain('type="datetime-local"'); expect(html).toContain('value="2026-10-07T00:15"');
    expect(html).toContain("Перенести публикацию"); expect(html).toContain("Отменить расписание");
    expect(html).toContain('name="intent" value="cancel"'); expect(html).toContain("Статья останется одобренной.");
  });
  it("offers initial scheduling only for approved content", () => {
    const html = renderToStaticMarkup(<ArticleSchedulePanel article={{ ...article, status: "approved", scheduledAt: null }} mayPublish />);
    expect(html).toContain("Запланировать публикацию"); expect(html).not.toContain("Отменить расписание");
    for (const status of ["draft", "in_review", "changes_requested", "published", "archived"] as const) {
      expect(renderToStaticMarkup(<ArticleSchedulePanel article={{ ...article, status }} mayPublish />)).toBe("");
    }
  });
  it("lets editorial readers see the schedule without publishing controls", () => {
    const html = renderToStaticMarkup(<ArticleSchedulePanel article={article} mayPublish={false} />);
    expect(html).toContain("Публикация запланирована"); expect(html).toContain("UTC+5");
    expect(html).not.toContain("<form"); expect(html).not.toContain("datetime-local");
  });
});
