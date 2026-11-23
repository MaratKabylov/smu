"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Globe,
  History,
  Info,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tag,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { CustomSelect } from "@/components/articles/CustomSelect";
import { searchOutputWorks } from "@/server/actions/research-output.actions";
import {
  researchOutputKinds,
  researchOutputLabels,
  type ResearchOutputKind,
} from "@/types/domain/research-output";
import type { ResearchOutputInput } from "@/lib/validation/research-output";

export type OutputWorkOption = {
  id: string;
  title: string;
  kind: "research" | "project";
  status: "draft" | "published" | "archived";
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  current?: {
    id: string;
    version: number;
    ownerId?: string;
    updatedAt?: string;
    versions?: Array<{
      version: number;
      createdAt: string;
      input: ResearchOutputInput;
    }>;
  } | null;
  initialWorks: OutputWorkOption[];
  initialUploads: { id: string; file_name: string; file_size: number }[];
  submitLabel?: string;
};

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "В архиве",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function ResearchOutputForm({
  action,
  current,
  initialWorks,
  initialUploads,
  submitLabel = current ? "Сохранить новую версию" : "Создать результат",
}: Props) {
  const input = current?.versions?.[0]?.input;

  const [activeLocale, setActiveLocale] = useState<"ru" | "kk" | "en">("ru");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Controlled translations for tabs and values
  const [titles, setTitles] = useState({
    ru: input?.ru?.title ?? "",
    kk: input?.kk?.title ?? "",
    en: input?.en?.title ?? "",
  });

  const [descriptions, setDescriptions] = useState({
    ru: input?.ru?.description ?? "",
    kk: input?.kk?.description ?? "",
    en: input?.en?.description ?? "",
  });

  // Works relations
  const [workIds, setWorkIds] = useState<string[]>(input?.workIds ?? []);
  const [works, setWorks] = useState<OutputWorkOption[]>(initialWorks);
  const [workQuery, setWorkQuery] = useState("");
  const [searchingWorks, setSearchingWorks] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState("");

  // Files
  const [files, setFiles] = useState<Array<{ id: string; isPublic: boolean }>>(
    input?.files ?? []
  );
  const [uploads, setUploads] = useState<{ id: string; file_name: string; file_size: number }[]>(
    initialUploads
  );
  const [uploading, setUploading] = useState(false);

  // Search works
  const handleSearchWorks = async () => {
    if (!workQuery.trim()) return;
    setSearchingWorks(true);
    setErrorMsg("");
    try {
      const result = await searchOutputWorks(workQuery.trim());
      if (!result.ok) throw new Error();
      setWorks((prev) => [
        ...result.options,
        ...prev.filter(
          (w) => workIds.includes(w.id) && !result.options.some((o) => o.id === w.id)
        ),
      ]);
    } catch {
      setErrorMsg("Не удалось найти работы. Попробуйте другой запрос.");
    } finally {
      setSearchingWorks(false);
    }
  };

  const handleAddWork = () => {
    if (!selectedWorkId || workIds.includes(selectedWorkId) || workIds.length >= 20) return;
    setWorkIds((prev) => [...prev, selectedWorkId]);
    setSelectedWorkId("");
  };

  const handleRemoveWork = (id: string) => {
    setWorkIds((prev) => prev.filter((wId) => wId !== id));
  };

  // Upload file
  const handleUploadFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setErrorMsg("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/results/uploads", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error();
      const item: { id: string; name: string; size: number } = await response.json();
      setUploads((prev) => [{ id: item.id, file_name: item.name, file_size: item.size }, ...prev]);
      setFiles((prev) => [...prev, { id: item.id, isPublic: false }]);
    } catch {
      setErrorMsg("Не удалось загрузить файл. Разрешены PDF, CSV (UTF-8) и ZIP до 4 МБ.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleTogglePublic = (fileId: string, isPublic: boolean) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, isPublic } : f))
    );
  };

  const kindOptions = researchOutputKinds.map((k) => ({
    value: k,
    label: researchOutputLabels.ru[k],
  }));

  const statusOptions = [
    { value: "draft", label: "Черновик" },
    { value: "published", label: "Опубликован" },
    { value: "archived", label: "В архиве" },
  ];

  const validateForm = (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMsg("");
    if (!titles.ru.trim() || titles.ru.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название результата на русском языке (минимум 3 символа).");
      setActiveLocale("ru");
      return;
    }
    if (!descriptions.ru.trim() || descriptions.ru.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите подробное описание на русском языке (минимум 20 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!titles.kk.trim() || titles.kk.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название результата на казахском языке (минимум 3 символа).");
      setActiveLocale("kk");
      return;
    }
    if (!descriptions.kk.trim() || descriptions.kk.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите подробное описание на казахском языке (минимум 20 символов).");
      setActiveLocale("kk");
      return;
    }
    if (titles.en.trim() || descriptions.en.trim()) {
      if (!titles.en.trim() || titles.en.trim().length < 3) {
        e.preventDefault();
        setErrorMsg("Если заполняется английская версия, название должно содержать от 3 символов.");
        setActiveLocale("en");
        return;
      }
      if (!descriptions.en.trim() || descriptions.en.trim().length < 20) {
        e.preventDefault();
        setErrorMsg("Если заполняется английская версия, описание должно содержать от 20 символов.");
        setActiveLocale("en");
        return;
      }
    }
    if (workIds.length === 0) {
      e.preventDefault();
      setErrorMsg("Необходимо связать хотя бы одно исследование или проект.");
      return;
    }
  };

  return (
    <form
      onSubmit={validateForm}
      action={async (formData) => {
        setPending(true);
        setErrorMsg("");
        try {
          await action(formData);
        } catch (e: any) {
          // Next.js redirect throws an error, which is normal
          if (e?.message?.includes("NEXT_REDIRECT") || e?.message?.includes("redirect:")) {
            throw e;
          }
          setErrorMsg("Произошла ошибка при сохранении.");
          setPending(false);
        }
      }}
      className="article-form wp-editor-form"
    >
      {errorMsg ? (
        <div role="alert" className="notice error-notice" style={{ marginBottom: "16px" }}>
          {errorMsg}
        </div>
      ) : null}

      {current ? (
        <>
          <input type="hidden" name="id" value={current.id} />
          <input type="hidden" name="expectedVersion" value={current.version} />
        </>
      ) : null}

      <input type="hidden" name="files" value={JSON.stringify(files)} />

      {/* TOPBAR: Standard WP Topbar with Tabs */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии">
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "ru"}
              className={`wp-lang-tab ${activeLocale === "ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("ru")}
            >
              <span className={`wp-tab-dot ${titles.ru.trim() && descriptions.ru.trim() ? "is-filled" : ""}`} />
              Русский
            </button>
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "kk"}
              className={`wp-lang-tab ${activeLocale === "kk" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("kk")}
            >
              <span className={`wp-tab-dot ${titles.kk.trim() && descriptions.kk.trim() ? "is-filled" : ""}`} />
              Қазақша
            </button>
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "en"}
              className={`wp-lang-tab ${activeLocale === "en" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("en")}
            >
              <span className={`wp-tab-dot ${titles.en.trim() && descriptions.en.trim() ? "is-filled" : ""}`} />
              English <small className="wp-tab-optional">необяз.</small>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          {current ? (
            <span className="stage-badge" style={{ fontSize: "12px", padding: "4px 10px" }}>
              Версия {current.version} ({input?.versionLabel ?? "1.0"})
            </span>
          ) : null}
          <button
            type="submit"
            disabled={pending || workIds.length === 0}
            className="primary-button wp-submit-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Save size={16} aria-hidden="true" />
            <span>{pending ? "Сохранение…" : submitLabel}</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE: 2 COLUMNS */}
      <div className="wp-editor-workspace">
        {/* MAIN COLUMN */}
        <div className="wp-editor-main">
          {/* MULTILINGUAL CONTENT PANELS */}
          {(["ru", "kk", "en"] as const).map((locale) => (
            <div
              key={locale}
              style={{ display: activeLocale === locale ? "block" : "none" }}
            >
              <div className="wp-editor-content-box">
                <div className="wp-title-section">
                  <label className="wp-field-label" htmlFor={`field-title-${locale}`}>
                    Название результата ({locale.toUpperCase()}){" "}
                    {locale !== "en" ? (
                      <span style={{ color: "#e11d48" }}>*</span>
                    ) : (
                      <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                    )}
                  </label>
                  <input
                    id={`field-title-${locale}`}
                    name={`${locale}.title`}
                    value={titles[locale]}
                    maxLength={240}
                    className="wp-title-input"
                    disabled={pending}
                    placeholder={
                      locale === "ru"
                        ? "Например: База геопространственных данных водоёмов Актюбинской области..."
                        : locale === "kk"
                        ? "Мысалы: Ақтөбе облысы су қоймаларының геокеңістіктік деректер базасы..."
                        : "E.g., Geospatial database of water bodies in Aktobe Region..."
                    }
                    onChange={(e) =>
                      setTitles((prev) => ({ ...prev, [locale]: e.target.value }))
                    }
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "12px", color: "#64748b" }}>
                    <span>{locale !== "en" ? "Минимум 3 символа, максимум 240" : "Для публикации на английском языке"}</span>
                    <span>{titles[locale].length}/240</span>
                  </div>
                </div>

                <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                  <label>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="wp-field-label">
                        Подробное описание ({locale.toUpperCase()}){" "}
                        {locale !== "en" ? (
                          <span style={{ color: "#e11d48" }}>*</span>
                        ) : (
                          <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                        )}
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {descriptions[locale].length} / 20000
                      </span>
                    </div>
                    <textarea
                      id={`field-desc-${locale}`}
                      name={`${locale}.description`}
                      rows={8}
                      maxLength={20000}
                      className="wp-excerpt-textarea"
                      disabled={pending}
                      placeholder={
                        locale === "ru"
                          ? "Опишите структуру данных, методологию сбора, ключевые показатели и применение результата исследований..."
                          : locale === "kk"
                          ? "Деректер құрылымын, жинау әдістемесін, негізгі көрсеткіштер мен зерттеу нәтижесін қолдануды сипаттаңыз..."
                          : "Describe the dataset structure, collection methodology, key metrics, and application of the research output..."
                      }
                      value={descriptions[locale]}
                      onChange={(e) =>
                        setDescriptions((prev) => ({ ...prev, [locale]: e.target.value }))
                      }
                    />
                  </label>
                  <p className="wp-field-hint" style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}>
                    {locale !== "en" ? "Минимум 20 символов." : "Минимум 20 символов, если поле заполнено."}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* CONNECTED WORKS SECTION */}
          <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Layers size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 650 }}>
                Связанные исследования и проекты <span style={{ color: "#e11d48" }}>*</span>
              </h2>
            </div>
            <p className="field-hint" style={{ marginTop: 0, marginBottom: "16px" }}>
              Укажите от 1 до 20 научных исследований или проектов. Для публикации результата все связанные работы должны быть опубликованы.
            </p>

            <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px", position: "relative" }}>
                <input
                  type="search"
                  value={workQuery}
                  placeholder="Поиск исследования или проекта по названию..."
                  maxLength={120}
                  onChange={(e) => setWorkQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSearchWorks();
                    }
                  }}
                  style={{ width: "100%", paddingRight: "36px" }}
                />
                <button
                  type="button"
                  onClick={() => void handleSearchWorks()}
                  disabled={searchingWorks || !workQuery.trim()}
                  style={{
                    position: "absolute",
                    right: "6px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    padding: "4px",
                  }}
                  title="Найти"
                >
                  <Search size={16} aria-hidden="true" />
                </button>
              </div>

              <div style={{ flex: "2 1 280px", display: "flex", gap: "8px" }}>
                <select
                  value={selectedWorkId}
                  onChange={(e) => setSelectedWorkId(e.target.value)}
                  aria-label="Выберите работу из списка"
                  style={{ flex: 1 }}
                >
                  <option value="">Выберите работу из найденных...</option>
                  {works
                    .filter((w) => !workIds.includes(w.id))
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title} ({w.kind === "project" ? "Проект" : "Исследование"} · {statusLabels[w.status] ?? w.status})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!selectedWorkId || workIds.length >= 20}
                  onClick={handleAddWork}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <Plus size={15} aria-hidden="true" />
                  <span>Связать</span>
                </button>
              </div>
            </div>

            {/* LIST OF CONNECTED WORKS */}
            {workIds.length ? (
              <ul className="pub-works-list">
                {workIds.map((id) => {
                  const work = works.find((w) => w.id === id);
                  return (
                    <li key={id} className="pub-work-card">
                      <input type="hidden" name="workIds" value={id} />
                      <span className="stage-badge" style={{ fontSize: "11px" }}>
                        {work ? (work.kind === "project" ? "Проект" : "Исследование") : "Работа"}
                      </span>
                      <span className="pub-work-title">
                        {work?.title ?? `Работа ID: ${id}`}
                      </span>
                      {work?.status ? (
                        <span className={`status-badge status-${work.status}`} style={{ fontSize: "11px" }}>
                          {statusLabels[work.status] ?? work.status}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleRemoveWork(id)}
                        className="pub-remove-link-btn"
                        title="Удалить связь"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        <span>Убрать</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="pub-empty-subgroup" style={{ color: "#e11d48" }}>
                Не выбрано ни одной связанной работы. Обязательно укажите хотя бы одно исследование или проект.
              </div>
            )}
          </section>

          {/* ATTACHED FILES SECTION */}
          <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 650 }}>
                  Прикреплённые файлы и данные ({files.length}/20)
                </h2>
              </div>
            </div>
            <p className="field-hint" style={{ marginTop: 0, marginBottom: "16px" }}>
              Форматы: PDF, CSV (в кодировке UTF-8), ZIP архивы до 4 МБ. По умолчанию файлы закрыты для публичного доступа. Отметьте «Публичный доступ», если файл должен скачиваться на странице результата.
            </p>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
              <label
                className="secondary-button"
                style={{
                  cursor: uploading || files.length >= 20 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Upload size={15} aria-hidden="true" />
                <span>{uploading ? "Загрузка…" : "Загрузить новый файл"}</span>
                <input
                  type="file"
                  accept=".pdf,.csv,.zip"
                  disabled={uploading || files.length >= 20}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    void handleUploadFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>

              {uploads.filter((u) => !files.some((f) => f.id === u.id)).length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <select
                    defaultValue=""
                    disabled={files.length >= 20}
                    onChange={(e) => {
                      if (e.target.value) {
                        setFiles((prev) => [...prev, { id: e.target.value, isPublic: false }]);
                        e.target.value = "";
                      }
                    }}
                    aria-label="Прикрепить ранее загруженный файл"
                  >
                    <option value="">Прикрепить ранее загруженный файл...</option>
                    {uploads
                      .filter((u) => !files.some((f) => f.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.file_name} ({formatBytes(u.file_size)})
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
            </div>

            {/* LIST OF FILES */}
            {files.length ? (
              <ul className="pub-works-list">
                {files.map((file) => {
                  const uploadItem = uploads.find((u) => u.id === file.id);
                  return (
                    <li key={file.id} className="pub-work-card">
                      <FileText size={18} style={{ color: "#64748b" }} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: "13.5px", color: "#0f172a", display: "block" }}>
                          {uploadItem?.file_name ?? `Файл ID: ${file.id}`}
                        </span>
                        {uploadItem?.file_size ? (
                          <small style={{ color: "#64748b" }}>
                            {formatBytes(uploadItem.file_size)}
                          </small>
                        ) : null}
                      </div>

                      <label
                        className="confirm-check"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          margin: 0,
                          fontSize: "12.5px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={file.isPublic}
                          onChange={(e) => handleTogglePublic(file.id, e.target.checked)}
                        />
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {file.isPublic ? (
                            <>
                              <Unlock size={13} style={{ color: "#16a34a" }} aria-hidden="true" />
                              <strong style={{ color: "#16a34a" }}>Публичный</strong>
                            </>
                          ) : (
                            <>
                              <Lock size={13} style={{ color: "#64748b" }} aria-hidden="true" />
                              <span style={{ color: "#64748b" }}>Закрытый доступ</span>
                            </>
                          )}
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id)}
                        className="pub-remove-link-btn"
                        title="Удалить файл"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        <span>Убрать</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="pub-empty-subgroup">
                К результату пока не прикреплено ни одного файла.
              </div>
            )}
          </section>

          {/* VERSION HISTORY ACCORDION */}
          {current?.versions && current.versions.length > 0 ? (
            <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <History size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 650 }}>
                  История версий ({current.versions.length})
                </h2>
              </div>
              <p className="field-hint" style={{ marginTop: 0, marginBottom: "16px" }}>
                При каждом сохранении создаётся новая версия результата. Прошлые версии сохраняются неизменными.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {current.versions.map((v) => (
                  <details
                    key={v.version}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "12px 16px",
                    }}
                  >
                    <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
                      Версия {v.version} · {v.input.versionLabel} · {new Date(v.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </summary>
                    <div style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "12px", fontSize: "13.5px" }}>
                      {v.input.changeNote ? (
                        <p style={{ margin: "0 0 8px 0", color: "#334155" }}>
                          <strong>Изменения:</strong> {v.input.changeNote}
                        </p>
                      ) : (
                        <p style={{ margin: "0 0 8px 0", color: "#94a3b8", fontStyle: "italic" }}>
                          Без комментария к версии
                        </p>
                      )}
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>RU:</strong> {v.input.ru.title}
                      </p>
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>Лицензия:</strong> {v.input.license}
                      </p>
                      {v.input.files.length ? (
                        <div style={{ marginTop: "8px" }}>
                          <span style={{ fontWeight: 600, color: "#475569" }}>Файлы версии:</span>
                          <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                            {v.input.files.map((f) => (
                              <li key={f.id} style={{ margin: "3px 0" }}>
                                <a
                                  href={`/api/results/${current.id}/files/${f.id}?version=${v.version}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: "var(--forest-bright)", textDecoration: "underline" }}
                                >
                                  {uploads.find((u) => u.id === f.id)?.file_name ?? "Скачать файл"}
                                </a>{" "}
                                <span style={{ color: "#64748b" }}>
                                  ({f.isPublic ? "Публичный" : "Закрытый доступ"})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* SIDEBAR */}
        <aside className="wp-editor-sidebar">
          {/* CARD 1: STATUS & SAVE */}
          <div className="article-editor-panel" style={{ padding: "20px" }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
              Публикация и версия
            </h3>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
                Статус
              </label>
              <CustomSelect
                name="status"
                defaultValue={input?.status ?? "draft"}
                options={statusOptions}
                ariaLabel="Статус публикации"
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label htmlFor="field-version-label" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
                Обозначение версии <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="field-version-label"
                name="versionLabel"
                required
                maxLength={80}
                defaultValue={input?.versionLabel ?? "1.0"}
                placeholder="1.0, 1.1, 2.0"
                style={{ width: "100%" }}
              />
              <small style={{ color: "#64748b", display: "block", marginTop: "3px" }}>
                Например: 1.0, 2.0-beta, Release 3
              </small>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="field-change-note" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
                Что изменилось в версии
              </label>
              <textarea
                id="field-change-note"
                name="changeNote"
                maxLength={2000}
                rows={3}
                placeholder="Краткое примечание о правках..."
                defaultValue=""
                style={{ width: "100%", fontSize: "13px" }}
              />
            </div>

            <button
              type="submit"
              disabled={pending || workIds.length === 0}
              className="primary-button"
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Save size={16} aria-hidden="true" />
              <span>{pending ? "Сохранение…" : submitLabel}</span>
            </button>
          </div>

          {/* CARD 2: METADATA */}
          <div className="article-editor-panel" style={{ padding: "20px" }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
              Параметры результата
            </h3>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
                Тип результата
              </label>
              <CustomSelect
                name="kind"
                defaultValue={input?.kind ?? "dataset"}
                options={kindOptions}
                ariaLabel="Тип научного результата"
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label htmlFor="field-license" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
                Лицензия / условия <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="field-license"
                name="license"
                required
                maxLength={160}
                defaultValue={input?.license ?? "CC BY 4.0"}
                placeholder="CC BY 4.0 / Открытый доступ"
                style={{ width: "100%" }}
              />
              <small style={{ color: "#64748b", display: "block", marginTop: "3px" }}>
                CC BY 4.0, MIT, Лицензия университета
              </small>
            </div>

            <div>
              <label htmlFor="field-external-url" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
                Внешняя ссылка (URL)
              </label>
              <input
                id="field-external-url"
                name="externalUrl"
                type="url"
                maxLength={1000}
                defaultValue={input?.externalUrl ?? ""}
                placeholder="https://..."
                style={{ width: "100%" }}
              />
              <small style={{ color: "#64748b", display: "block", marginTop: "3px" }}>
                Ссылка на репозиторий, интерактивную карту или Zenodo
              </small>
            </div>
          </div>

          {/* CARD 3: SYSTEM INFO */}
          {current ? (
            <div className="article-editor-panel" style={{ padding: "20px", fontSize: "13px", color: "#64748b" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Информация о записи
              </h3>
              <p style={{ margin: "4px 0" }}>
                <strong>Текущая версия:</strong> {current.version}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Всего версий:</strong> {current.versions?.length ?? 1}
              </p>
              {current.updatedAt ? (
                <p style={{ margin: "4px 0" }}>
                  <strong>Обновлено:</strong>{" "}
                  {new Date(current.updatedAt).toLocaleDateString("ru-RU")}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
