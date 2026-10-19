import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/server/services/access.service";
import { DashboardService } from "@/server/services/dashboard.service";
import { dashboardMetrics, type DashboardMetric } from "@/lib/dashboard";

export default async function AdminPage() {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") notFound();
  const data = await new DashboardService().read(result.access);
  return <div className="content-page">
    <div className="page-heading"><div><p className="page-kicker">Научная платформа</p><h1>Обзор работы</h1><p>Текущие данные по доступным вам разделам.</p></div></div>
    <section className="dashboard-grid" aria-label="Показатели платформы">
      {Object.entries(data.metrics).map(([key, count]) => {
        const metric = dashboardMetrics[key as DashboardMetric];
        return <Link className="dashboard-metric" href={metric.href} key={key}><span>{metric.label}</span><strong>{count}</strong></Link>;
      })}
      {!Object.keys(data.metrics).length && <p>Для вашей роли нет доступных показателей.</p>}
    </section>
    <div className="dashboard-lists">{([
      ["Мои черновики", data.ownDrafts], ["Ожидают моей проверки", data.reviewQueue],
    ] as const).map(([title, articles], i) => (i === 0 ? dashboardMetrics.own_drafts : dashboardMetrics.review_articles).allowed(result.access) &&
      <section className="data-panel" key={title}><div className="data-panel-header"><h2>{title}</h2></div>
        {articles.length ? <ul className="dashboard-records">{articles.map(article => <li key={article.id}><Link href={`/admin/content/articles/${article.id}`}>{article.title}</Link></li>)}</ul> : <p className="dashboard-empty">Материалов нет.</p>}
      </section>)}
    </div>
    {result.access.permissions.has("audit.read") && <section className="data-panel"><div className="data-panel-header"><h2>Последние действия</h2><Link href="/admin/audit">Весь журнал</Link></div>
      {data.recentActions.length ? <ul className="dashboard-records">{data.recentActions.map(action => <li key={action.id}><time dateTime={action.created_at}>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(action.created_at))} UTC</time> · {action.entity_type} · {action.action}</li>)}</ul> : <p className="dashboard-empty">Действий пока нет.</p>}
    </section>}
  </div>;
}
