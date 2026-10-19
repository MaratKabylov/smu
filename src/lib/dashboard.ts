import { z } from "zod";
import type { AccessContext, PermissionCode } from "@/types/domain/auth";

const has = (a: AccessContext, code: PermissionCode) => a.permissions.has(code);
const globalArticles = (a: AccessContext) => has(a, "articles.edit_any") || has(a, "articles.publish");
export const dashboardMetrics = {
  scientists: { label: "Всего учёных", href: "/admin/science/scientists", allowed: (a: AccessContext) => has(a, "scientists.edit") || has(a, "scientists.verify") },
  pending_scientists: { label: "Ожидают верификации", href: "/admin/science/scientists?status=pending", allowed: (a: AccessContext) => has(a, "scientists.verify") },
  active_research: { label: "Активные исследования", href: "/admin/science/research", allowed: (a: AccessContext) => has(a, "research.manage") },
  active_projects: { label: "Активные проекты", href: "/admin/science/projects", allowed: (a: AccessContext) => has(a, "projects.manage") },
  mentorship_applications: { label: "Новые заявки наставничества", href: "/admin/programs/mentorship/applications?status=new", allowed: (a: AccessContext) => has(a, "mentorship.manage") },
  program_applications: { label: "Новые заявки Research Program", href: "/admin/programs/research-program/applications?status=new", allowed: (a: AccessContext) => has(a, "research_program.manage") },
  research_proposals: { label: "Новые предложения исследований", href: "/admin/support/research_proposal?status=new", allowed: (a: AccessContext) => has(a, "research_proposals.manage") },
  it_requests: { label: "Новые IT-заявки", href: "/admin/support/it_request?status=new", allowed: (a: AccessContext) => has(a, "it_requests.manage") },
  publication_requests: { label: "Новые обращения по публикациям", href: "/admin/support/publication_support?status=new", allowed: (a: AccessContext) => has(a, "publication_support.manage") },
  article_drafts: { label: "Черновики статей", href: "/admin/content/articles?status=draft", allowed: globalArticles },
  scheduled_articles: { label: "Запланированные статьи", href: "/admin/content/articles?status=scheduled", allowed: globalArticles },
  review_articles: { label: "Статьи на моей проверке", href: "/admin/content/articles?status=in_review", allowed: (a: AccessContext) => has(a, "articles.review") },
  own_drafts: { label: "Мои черновики", href: "/ru/account/articles", allowed: (a: AccessContext) => has(a, "articles.edit_own") || globalArticles(a) },
  upcoming_events: { label: "Предстоящие события", href: "/admin/programs/events", allowed: (a: AccessContext) => has(a, "events.manage") },
  expiring_opportunities: { label: "Срок истекает в ближайшие 7 дней", href: "/admin/opportunities", allowed: (a: AccessContext) => has(a, "opportunities.manage") },
} as const;
export type DashboardMetric = keyof typeof dashboardMetrics;
const articleSchema = z.object({ id: z.uuid(), title: z.string() });
export const dashboardSchema = z.object({
  metrics: z.partialRecord(z.enum(Object.keys(dashboardMetrics) as [DashboardMetric, ...DashboardMetric[]]), z.number().int().nonnegative()),
  ownDrafts: z.array(articleSchema).max(5), reviewQueue: z.array(articleSchema).max(5),
  recentActions: z.array(z.object({ id: z.uuid(), created_at: z.string(), entity_type: z.string(), action: z.string() })).max(5),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export function filterDashboard(data: Dashboard, access: AccessContext): Dashboard {
  return {
    metrics: Object.fromEntries(Object.entries(data.metrics).filter(([key]) => dashboardMetrics[key as DashboardMetric].allowed(access))),
    ownDrafts: dashboardMetrics.own_drafts.allowed(access) ? data.ownDrafts : [],
    reviewQueue: dashboardMetrics.review_articles.allowed(access) ? data.reviewQueue : [],
    recentActions: access.permissions.has("audit.read") ? data.recentActions : [],
  };
}
