"use client";

import { useActionState } from "react";
import {
  FileText,
  Save,
  Send,
  Settings,
  UploadCloud,
  User,
} from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { supportCopy } from "@/lib/i18n/support-request";
import {
  supportAllowsFiles,
  supportFields,
  supportPriorities,
  type SupportKind,
} from "@/lib/support-request-constants";
import type { SupportRecord } from "@/lib/validation/support-request";
import {
  submitSupportRequest,
  updateSupportRequest,
  type SupportFormState,
} from "@/server/actions/support-request.actions";

export function SupportForm({ locale, kind }: { locale: Locale; kind: SupportKind }) {
  const copy = supportCopy[locale];
  const allowsFiles = supportAllowsFiles(kind);
  const [state, action, pending] = useActionState(
    submitSupportRequest.bind(null, locale, kind),
    {} as SupportFormState
  );

  return (
    <form action={action} className="login-form support-form wp-public-support-form">
      <div
        className="notice"
        style={{
          background: "#f0f9ff",
          borderColor: "#bae6fd",
          color: "#0369a1",
          marginBottom: "20px",
          lineHeight: 1.5,
          fontSize: "13.5px",
        }}
      >
        <p style={{ margin: 0 }}>{copy.guest}</p>
      </div>

      <fieldset
        disabled={pending || state.message === "saved"}
        style={{ display: "flex", flexDirection: "column", gap: "20px", border: 0, padding: 0 }}
      >
        {/* SECTION 1: APPLICANT DETAILS */}
        <div
          className="wp-editor-content-box"
          style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingBottom: "10px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <User size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>
              {copy.sections.applicant}
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "14px",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="wp-field-label">
                {copy.contactName} <span style={{ color: "#e11d48" }}>*</span>
              </span>
              <input
                name="contactName"
                required
                minLength={2}
                maxLength={160}
                autoComplete="name"
                placeholder={copy.placeholders.contactName}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="wp-field-label">
                {copy.email} <span style={{ color: "#e11d48" }}>*</span>
              </span>
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder={copy.placeholders.email}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span className="wp-field-label">{copy.organization}</span>
            <input
              name="organization"
              maxLength={200}
              autoComplete="organization"
              placeholder={copy.placeholders.organization}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
          </label>
        </div>

        {/* SECTION 2: TITLE & MAIN DESCRIPTION */}
        <div
          className="wp-editor-content-box"
          style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingBottom: "10px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <FileText size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>
              {copy.sections.subject}
            </h2>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span className="wp-field-label">
              {copy.name} <span style={{ color: "#e11d48" }}>*</span>
            </span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              placeholder={copy.placeholders.title}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span className="wp-field-label">
              {copy.description} <span style={{ color: "#e11d48" }}>*</span>
            </span>
            <textarea
              name="description"
              required
              minLength={20}
              maxLength={20000}
              rows={6}
              placeholder={copy.placeholders.description}
              style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
          </label>
        </div>

        {/* SECTION 3: SPECIFIC DETAILS FOR THIS KIND */}
        <div
          className="wp-editor-content-box"
          style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingBottom: "10px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <Settings size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>
              {copy.sections.parameters}
            </h2>
          </div>

          {supportFields[kind].map((field) => (
            <label key={field} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="wp-field-label">
                {copy.fields[field]} <span style={{ color: "#e11d48" }}>*</span>
              </span>
              <textarea
                name={field}
                required
                minLength={2}
                maxLength={5000}
                rows={3}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
          ))}
        </div>

        {/* SECTION 4: FILE ATTACHMENTS */}
        {allowsFiles && (
          <div
            className="wp-editor-content-box"
            style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                paddingBottom: "10px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <UploadCloud size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>
                {copy.sections.attachments}
              </h2>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span className="wp-field-label">{copy.files}</span>
              <input
                name="files"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px dashed #cbd5e1",
                  background: "#f8fafc",
                  fontSize: "13px",
                }}
              />
            </label>
            <small style={{ color: "#64748b", fontSize: "12px" }}>
              {copy.sections.attachmentsHint}
            </small>
          </div>
        )}

        {/* HONEYPOT ANTI-SPAM */}
        <div className="support-honeypot" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {/* CONSENT & SUBMIT */}
        <div style={{ marginTop: "6px" }}>
          <label className="confirm-check" style={{ cursor: "pointer", display: "flex", gap: "8px" }}>
            <input
              type="checkbox"
              name="consent"
              value="yes"
              required
              style={{ marginTop: "3px" }}
            />
            <span style={{ fontSize: "13px", color: "#334155", lineHeight: 1.4 }}>
              {allowsFiles ? copy.consent : copy.consentNoFiles}
            </span>
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={pending || state.message === "saved"}
            style={{
              marginTop: "16px",
              padding: "10px 24px",
              fontSize: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Send size={15} aria-hidden="true" />
            <span>{pending ? copy.pending : copy.submit}</span>
          </button>
        </div>
      </fieldset>

      {state.message && (
        <p
          role={state.message === "saved" ? "status" : "alert"}
          aria-live="polite"
          className={`notice ${state.message === "saved" ? "success-notice" : "error-notice"}`}
          style={{ marginTop: "20px" }}
        >
          {copy[state.message]}
          {state.id && <> · {state.id}</>}
        </p>
      )}
    </form>
  );
}

const transitions = {
  new: ["new", "in_review", "rejected"],
  in_review: ["in_review", "in_progress", "rejected"],
  in_progress: ["in_progress", "in_review", "completed", "rejected"],
  completed: ["completed", "in_review"],
  rejected: ["rejected", "in_review"],
} as const;

export function SupportManageForm({
  record,
  assignees,
}: {
  record: SupportRecord;
  assignees: { id: string; name: string }[];
}) {
  const copy = supportCopy.ru;
  const [state, action, pending] = useActionState(
    updateSupportRequest.bind(null, "ru", record.id, record.version!),
    {} as SupportFormState
  );

  return (
    <form action={action} className="login-form support-form wp-manage-form">
      <fieldset
        disabled={pending || state.message === "saved" || state.message === "stale"}
        style={{
          border: 0,
          padding: "20px",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            paddingBottom: "10px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <Settings size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 650 }}>Управление заявкой</h3>
        </div>

        {/* STATUS */}
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="wp-field-label">{copy.status}</span>
          <select
            name="status"
            defaultValue={record.status}
            style={{ width: "100%", padding: "8px 10px", fontSize: "13.5px" }}
          >
            {transitions[record.status].map((status) => (
              <option key={status} value={status}>
                {copy.statuses[status]}
              </option>
            ))}
          </select>
        </label>

        {/* PRIORITY */}
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="wp-field-label">{copy.priority}</span>
          <select
            name="priority"
            defaultValue={record.priority}
            style={{ width: "100%", padding: "8px 10px", fontSize: "13.5px" }}
          >
            {supportPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {copy.priorities[priority]}
              </option>
            ))}
          </select>
        </label>

        {/* ASSIGNED TO */}
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="wp-field-label">{copy.assignedTo}</span>
          <select
            name="assignedTo"
            defaultValue={record.assignedTo ?? ""}
            style={{ width: "100%", padding: "8px 10px", fontSize: "13.5px" }}
          >
            <option value="">{copy.unassigned}</option>
            {record.assignedTo && !assignees.some((a) => a.id === record.assignedTo) && (
              <option value={record.assignedTo} disabled>
                {record.assignedTo}
              </option>
            )}
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>

        {/* NOTE */}
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="wp-field-label">{copy.note}</span>
          <textarea
            name="note"
            maxLength={5000}
            defaultValue={record.managerNote}
            rows={4}
            placeholder="Внутренний служебный комментарий модератора..."
            style={{ width: "100%", padding: "8px 10px", fontSize: "13px" }}
          />
        </label>

        <button
          type="submit"
          className="primary-button"
          disabled={pending || state.message === "saved" || state.message === "stale"}
          style={{
            marginTop: "6px",
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Save size={15} aria-hidden="true" />
          <span>{pending ? copy.pending : copy.save}</span>
        </button>

        {/* RECORD METADATA */}
        <div
          style={{
            marginTop: "10px",
            paddingTop: "12px",
            borderTop: "1px solid #f1f5f9",
            fontSize: "11.5px",
            color: "#64748b",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div>Версия записи: {record.version}</div>
          <div>Создано: {record.createdAt}</div>
          <div>Обновлено: {record.updatedAt}</div>
        </div>
      </fieldset>

      {state.message && (
        <p
          role={state.message === "saved" ? "status" : "alert"}
          className={`notice ${state.message === "saved" ? "success-notice" : "error-notice"}`}
          style={{ marginTop: "12px" }}
        >
          {state.message === "saved" ? "Изменения сохранены." : copy[state.message]}
        </p>
      )}
    </form>
  );
}
