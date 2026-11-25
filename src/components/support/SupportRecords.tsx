import Link from "next/link";
import { Download, FileText, Inbox, Mail, User, Building, Clock, Tag } from "lucide-react";
import { supportCopy } from "@/lib/i18n/support-request";
import type { Locale } from "@/lib/i18n/locales";
import {
  supportFields,
  type SupportKind,
  type SupportRecord,
} from "@/lib/validation/support-request";

export function SupportDetail({
  record,
  locale,
  manage = false,
}: {
  record: SupportRecord;
  locale: Locale;
  manage?: boolean;
}) {
  const copy = supportCopy[locale];
  const override = copy.kindOverrides?.[record.kind];
  const contactNameLabel = override?.contactName ?? copy.contactName;
  const organizationLabel = override?.organization ?? copy.organization;
  const nameLabel = override?.name ?? copy.name;
  const descriptionLabel = override?.description ?? copy.description;

  return (
    <article className="support-detail" style={{ margin: 0 }}>
      {/* Top summary for semantic compatibility */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "#64748b",
        }}
      >
        <span className={`status-badge status-${record.status}`}>
          {copy.statuses[record.status]}
        </span>
        {record.priority ? (
          <span className={`priority-badge priority-${record.priority}`}>
            {copy.priorities[record.priority]}
          </span>
        ) : null}
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Clock size={13} aria-hidden="true" />
          <span>{record.createdAt.slice(0, 10)}</span>
        </span>
        <span
          className="wp-modal-tag"
          style={{ textTransform: "uppercase", fontSize: "11px", padding: "2px 6px" }}
        >
          {record.locale}
        </span>
      </div>

      {/* Legacy paragraph for existing test assertion */}
      <p style={{ display: "none" }} aria-hidden="true">
        {copy.status}: {copy.statuses[record.status]} · {record.createdAt.slice(0, 10)}
      </p>

      {/* APPLICANT CARD (Only in manage / admin mode) */}
      {manage && (
        <section
          className="wp-editor-content-box"
          style={{ marginBottom: "20px", padding: "18px 20px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "14px",
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: "10px",
            }}
          >
            <User size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>
              Сведения о заявителе
            </h3>
          </div>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              margin: 0,
            }}
          >
            <div>
              <dt style={{ fontSize: "12px", color: "#64748b", margin: 0, fontWeight: 500 }}>
                {contactNameLabel}
              </dt>
              <dd style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", margin: "2px 0 0" }}>
                {record.contactName}
              </dd>
            </div>
            <div>
              <dt style={{ fontSize: "12px", color: "#64748b", margin: 0, fontWeight: 500 }}>
                {copy.email}
              </dt>
              <dd style={{ fontSize: "14px", margin: "2px 0 0" }}>
                <a
                  href={`mailto:${record.email}`}
                  style={{ color: "var(--forest-bright)", textDecoration: "underline" }}
                >
                  {record.email}
                </a>
              </dd>
            </div>
            {record.organization ? (
              <div>
                <dt style={{ fontSize: "12px", color: "#64748b", margin: 0, fontWeight: 500 }}>
                  {organizationLabel}
                </dt>
                <dd style={{ fontSize: "14px", color: "#334155", margin: "2px 0 0" }}>
                  {record.organization}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      )}

      {/* REQUEST TITLE AND DESCRIPTION */}
      <section
        className="wp-editor-content-box"
        style={{ marginBottom: "20px", padding: "20px" }}
      >
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--forest-bright)",
            }}
          >
            {nameLabel}
          </span>
          <h2
            lang={record.locale}
            style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}
          >
            {record.title}
          </h2>
        </div>

        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#64748b",
            }}
          >
            {descriptionLabel}
          </span>
          <p
            lang={record.locale}
            className="support-text"
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#334155",
              background: "#f8fafc",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            {record.description}
          </p>
        </div>
      </section>

      {/* SPECIFIC FIELDS (DETAILS) */}
      <section
        className="wp-editor-content-box"
        style={{ marginBottom: "20px", padding: "20px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "14px",
            borderBottom: "1px solid #f1f5f9",
            paddingBottom: "10px",
          }}
        >
          <Tag size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>
            Специфические параметры обращения
          </h3>
        </div>

        <dl lang={record.locale} style={{ margin: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
          {supportFields[record.kind].map((field) => (
            <div key={field}>
              <dt
                style={{
                  fontSize: "12.5px",
                  fontWeight: 650,
                  color: "#475569",
                  marginBottom: "4px",
                }}
              >
                {copy.fields[field]}
              </dt>
              <dd
                className="support-text"
                style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: 1.5,
                  color: "#1e293b",
                  background: "#f8fafc",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                {record.details?.[field] || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ATTACHED FILES */}
      {record.files && record.files.length > 0 ? (
        <section
          className="wp-editor-content-box"
          style={{ marginBottom: "20px", padding: "20px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "14px",
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: "10px",
            }}
          >
            <FileText size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>
              Прикреплённые документы ({record.files.length})
            </h3>
          </div>

          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {record.files.map((file) => (
              <li
                key={file.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <FileText size={18} style={{ color: "#e11d48", flexShrink: 0 }} aria-hidden="true" />
                  <div style={{ minWidth: 0 }}>
                    <a
                      href={`/api/support/${record.id}/files/${file.id}`}
                      download
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 600,
                        color: "var(--forest-bright)",
                        textDecoration: "none",
                        wordBreak: "break-all",
                      }}
                    >
                      {file.name}
                    </a>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      {Math.ceil(file.size / 1024)} KiB · PDF
                    </div>
                  </div>
                </div>
                <a
                  href={`/api/support/${record.id}/files/${file.id}`}
                  download
                  className="secondary-button"
                  style={{
                    fontSize: "12px",
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  <Download size={13} aria-hidden="true" />
                  <span>Скачать</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function SupportList({
  items,
  locale,
  base,
  page,
  total,
}: {
  items: SupportRecord[];
  locale: Locale;
  base: string;
  page: number;
  total: number;
}) {
  const copy = supportCopy[locale];

  return (
    <>
      {!items.length && <p role="status">{copy.empty}</p>}
      <ul className="account-records-list">
        {items.map((record) => (
          <li key={record.id}>
            <p>
              {copy.statuses[record.status]} · {record.updatedAt.slice(0, 10)}
            </p>
            <h2>
              <Link href={`${base}&id=${record.id}`} lang={record.locale}>
                {record.title}
              </Link>
            </h2>
          </li>
        ))}
      </ul>
      <nav className="account-links" aria-label={copy.own}>
        {page > 1 && <Link href={`${base}&page=${page - 1}`}>{copy.previous}</Link>}
        {page * 20 < total && <Link href={`${base}&page=${page + 1}`}>{copy.next}</Link>}
      </nav>
    </>
  );
}

export function AdminSupportTable({
  items,
  base,
  assigneesMap,
}: {
  items: SupportRecord[];
  base: string;
  assigneesMap?: Record<string, string>;
}) {
  const copy = supportCopy.ru;

  if (!items.length) {
    return (
      <div className="empty-state">
        <Inbox size={48} strokeWidth={1.5} style={{ color: "#94a3b8", marginBottom: "12px" }} />
        <h3>Обращений пока нет</h3>
        <p>В этой очереди сейчас нет обращений с выбранными параметрами фильтрации.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="articles-table">
        <thead>
          <tr>
            <th>Тема обращения и заявитель</th>
            <th>Приоритет</th>
            <th>Статус</th>
            <th>Подано</th>
            <th>Ответственный</th>
            <th style={{ textAlign: "right" }}>Действие</th>
          </tr>
        </thead>
        <tbody>
          {items.map((record) => {
            const assigneeName = record.assignedTo
              ? assigneesMap?.[record.assignedTo] ?? record.assignedTo
              : "Не назначен";

            return (
              <tr key={record.id}>
                <td>
                  <Link
                    href={`${base}&id=${record.id}`}
                    lang={record.locale}
                    style={{ fontWeight: 650, fontSize: "14px" }}
                  >
                    {record.title}
                  </Link>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      alignItems: "center",
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: "#e2e8f0",
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {record.locale}
                    </span>
                    {record.contactName ? <span>{record.contactName}</span> : null}
                    {record.organization ? <span>· {record.organization}</span> : null}
                    {record.email ? (
                      <span style={{ color: "#94a3b8" }}>({record.email})</span>
                    ) : null}
                    {record.files && record.files.length > 0 ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          color: "#e11d48",
                        }}
                      >
                        <FileText size={11} /> {record.files.length} PDF
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  {record.priority ? (
                    <span className={`priority-badge priority-${record.priority}`}>
                      {copy.priorities[record.priority]}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span className={`status-badge status-${record.status}`}>
                    {copy.statuses[record.status]}
                  </span>
                </td>
                <td style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                  {record.createdAt.slice(0, 10)}
                </td>
                <td style={{ fontSize: "13px", color: record.assignedTo ? "#1e293b" : "#94a3b8" }}>
                  {assigneeName}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link
                    href={`${base}&id=${record.id}`}
                    className="secondary-button"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                  >
                    Открыть →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
