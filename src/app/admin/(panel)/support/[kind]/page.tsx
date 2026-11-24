import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { SupportManageForm } from "@/components/support/SupportForm";
import {
  AdminSupportTable,
  SupportDetail,
  SupportList,
} from "@/components/support/SupportRecords";
import { supportAdminMeta, supportCopy } from "@/lib/i18n/support-request";
import { accountPageNumber, accountRecordIdSchema } from "@/lib/validation/account-records";
import {
  supportKindSchema,
  supportPermissions,
  supportStatuses,
  type SupportKind,
} from "@/lib/validation/support-request";
import { getAdminAccess } from "@/server/services/access.service";
import { SupportRequestService } from "@/server/services/support-request.service";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ status?: string; page?: string; id?: string }>;
}) {
  const kind = supportKindSchema.safeParse((await params).kind);
  const query = await searchParams;

  if (!kind.success || (query.id && !accountRecordIdSchema.safeParse(query.id).success)) {
    notFound();
  }

  const copy = supportCopy.ru;
  const access = await getAdminAccess();

  if (access.state === "unauthenticated") {
    redirect("/admin/login");
  }

  if (
    access.state !== "allowed" ||
    !access.access.permissions.has(supportPermissions[kind.data])
  ) {
    return <p role="alert">Недостаточно прав для этой очереди.</p>;
  }

  const status = supportStatuses.find((s) => s === query.status) ?? "all";
  const page = accountPageNumber(query.page);
  const base = `/admin/support/${kind.data}?status=${status}`;
  const meta = supportAdminMeta[kind.data];

  let data;
  let assignees: { id: string; name: string }[] = [];

  try {
    const service = new SupportRequestService();
    [data, assignees] = await Promise.all([
      service.list(
        kind.data,
        true,
        page,
        query.id ?? null,
        query.id ? "all" : status
      ),
      query.id ? service.assignees(kind.data) : Promise.resolve([]),
    ]);
  } catch {
    return <p role="alert">{copy.unavailable}</p>;
  }

  if (query.id && !data.items[0]) {
    notFound();
  }

  const currentRecord = data.items[0];

  return (
    <section className="support-admin content-page">
      {query.id && currentRecord ? (
        /* DETAIL VIEW */
        <>
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link href="/admin">Панель управления</Link>
            <span>/</span>
            <Link href={`/admin/support/${kind.data}`}>{meta.title}</Link>
            <span>/</span>
            <strong>{currentRecord.title}</strong>
          </nav>

          <Link className="back-link" href={base}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{copy.back} к очереди</span>
          </Link>

          <div className="media-detail-heading" style={{ marginBottom: "20px" }}>
            <div>
              <p className="page-kicker">{meta.kicker}</p>
              <h1 style={{ wordBreak: "break-word" }}>{currentRecord.title}</h1>
              <p>
                Подано {currentRecord.createdAt.slice(0, 10)} · Заявитель:{" "}
                <strong>{currentRecord.contactName}</strong>
                {currentRecord.organization ? ` (${currentRecord.organization})` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {currentRecord.priority ? (
                <span className={`priority-badge priority-${currentRecord.priority}`}>
                  {copy.priorities[currentRecord.priority]}
                </span>
              ) : null}
              <span className={`status-badge status-${currentRecord.status}`}>
                {copy.statuses[currentRecord.status]}
              </span>
            </div>
          </div>

          <div
            className="wp-editor-workspace"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
              alignItems: "start",
            }}
          >
            <div className="wp-editor-main">
              <SupportDetail record={currentRecord} locale="ru" manage />
            </div>
            <aside className="wp-editor-sidebar">
              <SupportManageForm
                key={currentRecord.version}
                record={currentRecord}
                assignees={assignees}
              />
            </aside>
          </div>
        </>
      ) : (
        /* LIST VIEW */
        <>
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link href="/admin">Панель управления</Link>
            <span>/</span>
            <span>Поддержка</span>
            <span>/</span>
            <strong>{meta.title}</strong>
          </nav>

          <div className="page-heading media-page-heading">
            <div>
              <p className="page-kicker">{meta.kicker}</p>
              <h1>{meta.title}</h1>
              <p>{meta.description}</p>
            </div>
          </div>

          <section className="media-toolbar">
            <form action={`/admin/support/${kind.data}`} className="media-filters">
              <label className="visually-hidden" htmlFor="support-status-select">
                {copy.status}
              </label>
              <select
                id="support-status-select"
                name="status"
                defaultValue={status}
                aria-label="Фильтр по статусу"
              >
                <option value="all">{copy.all}</option>
                {supportStatuses.map((s) => (
                  <option key={s} value={s}>
                    {copy.statuses[s]}
                  </option>
                ))}
              </select>
              <button className="secondary-button" type="submit">
                {copy.filter}
              </button>
            </form>
            <span className="real-count">
              {data.total} {data.total === 1 ? "обращение" : data.total > 1 && data.total < 5 ? "обращения" : "обращений"} · Страница {page}
            </span>
          </section>

          <section className="data-panel">
            <div className="data-panel-header">
              <div>
                <h2>{copy.queue}</h2>
                <p>
                  Поступающие запросы и инициативы, требующие рассмотрения и назначения ответственного сотрудника.
                </p>
              </div>
            </div>

            <AdminSupportTable items={data.items} base={base} />

            {data.total > 20 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Страница {page} из {Math.max(1, Math.ceil(data.total / 20))}
                </span>
                <nav className="account-links" aria-label={copy.own} style={{ margin: 0 }}>
                  {page > 1 ? (
                    <Link href={`${base}&page=${page - 1}`} className="secondary-button">
                      {copy.previous}
                    </Link>
                  ) : null}
                  {page * 20 < data.total ? (
                    <Link href={`${base}&page=${page + 1}`} className="secondary-button">
                      {copy.next}
                    </Link>
                  ) : null}
                </nav>
              </div>
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
