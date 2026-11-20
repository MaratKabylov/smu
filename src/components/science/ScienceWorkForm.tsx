"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Image as ImageIcon, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { CustomSelect } from "@/components/articles/CustomSelect";
import { generateSlug } from "@/lib/articles/slug";
import {
  scienceWorkPath,
  scienceWorkStageLabels,
  scienceWorkStatusLabels,
} from "@/lib/science-work";
import type { MediaAsset } from "@/types/domain/media";
import {
  scienceWorkStages,
  type ScienceWork,
  type ScienceWorkKind,
  type ScienceWorkOptions,
  type ScienceWorkStage,
} from "@/types/domain/science-work";

type Props = {
  action: (form: FormData) => Promise<void>;
  work?: ScienceWork;
  options: ScienceWorkOptions;
  media: MediaAsset[];
  kind?: ScienceWorkKind;
  submitLabel?: string;
};

export function ScienceWorkForm({
  action,
  work,
  options,
  media,
  kind = work?.kind ?? "research",
  submitLabel = work ? "Сохранить изменения" : "Создать черновик",
}: Props) {
  const mediaSearchId = useId();
  const memberSearchId = useId();

  const [activeLocale, setActiveLocale] = useState<"Ru" | "Kk" | "En">("Ru");
  const [pending, setPending] = useState(false);

  // Translations
  const ru = work?.translations.find((item) => item.locale === "ru");
  const kk = work?.translations.find((item) => item.locale === "kk");
  const en = work?.translations.find((item) => item.locale === "en");

  const [titles, setTitles] = useState({
    Ru: ru?.title ?? "",
    Kk: kk?.title ?? "",
    En: en?.title ?? "",
  });

  const [slugs, setSlugs] = useState({
    Ru: ru?.slug ?? "",
    Kk: kk?.slug ?? "",
    En: en?.slug ?? "",
  });

  const [isSlugTouched, setIsSlugTouched] = useState({
    Ru: Boolean(ru?.slug),
    Kk: Boolean(kk?.slug),
    En: Boolean(en?.slug),
  });

  const [summaries, setSummaries] = useState({
    Ru: ru?.summary ?? "",
    Kk: kk?.summary ?? "",
    En: en?.summary ?? "",
  });

  const [descriptions, setDescriptions] = useState({
    Ru: ru?.description ?? "",
    Kk: kk?.description ?? "",
    En: en?.description ?? "",
  });

  const [results, setResults] = useState({
    Ru: ru?.results ?? "",
    Kk: kk?.results ?? "",
    En: en?.results ?? "",
  });

  // Media Cover
  const [coverMediaId, setCoverMediaId] = useState<string>(() => work?.coverMediaId ?? "");
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");

  const selectedCover = media.find((m) => m.id === coverMediaId);
  const coverDisplayUrl = selectedCover?.previewUrl || (coverMediaId === work?.coverMediaId ? work?.coverUrl : null);

  const filteredMedia = media.filter(
    (asset) =>
      asset.previewUrl &&
      asset.status === "ready" &&
      !asset.deletedAt &&
      (!mediaSearchQuery.trim() ||
        asset.fileName.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
        (asset.altRu && asset.altRu.toLowerCase().includes(mediaSearchQuery.toLowerCase())))
  );

  // Leader and Members
  const initialLeader = work?.members.find((item) => item.role === "lead");
  const [leadScientistId, setLeadScientistId] = useState<string>(() => initialLeader?.id ?? "");

  const initialMembers = new Set(
    work?.members.filter((item) => item.role === "member").map((item) => item.id) ?? []
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => initialMembers);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Scientists list
  const scientists = [...options.scientists];
  for (const member of work?.members ?? []) {
    if (!scientists.some((item) => item.id === member.id)) {
      scientists.push({
        id: member.id,
        name:
          (member.translations.find((item) => item.locale === "ru")?.fullName ?? member.id) +
          " (недоступен — удалите из команды)",
      });
    }
  }

  // Handle title & slug change
  const handleTitleChange = (locale: "Ru" | "Kk" | "En", value: string) => {
    setTitles((prev) => ({ ...prev, [locale]: value }));
    if (!isSlugTouched[locale]) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(value) }));
    }
  };

  const handleSlugChange = (locale: "Ru" | "Kk" | "En", value: string) => {
    setSlugs((prev) => ({ ...prev, [locale]: value }));
    setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
  };

  const handleRegenerateSlug = (locale: "Ru" | "Kk" | "En") => {
    const autoSlug = generateSlug(titles[locale]);
    setSlugs((prev) => ({ ...prev, [locale]: autoSlug }));
    setIsSlugTouched((prev) => ({ ...prev, [locale]: false }));
  };

  // When leader changes, remove from selected members
  const handleLeaderChange = (newLeaderId: string) => {
    setLeadScientistId(newLeaderId);
    if (newLeaderId && selectedMemberIds.has(newLeaderId)) {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(newLeaderId);
        return next;
      });
    }
  };

  const toggleMember = (id: string, checked: boolean) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Client validation before submit
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;

    // 1. Direction validation
    const fieldSelect = form.elements.namedItem("fieldId") as HTMLSelectElement | null;
    if (!fieldSelect?.value) {
      event.preventDefault();
      alert("Пожалуйста, укажите научное направление в боковой панели.");
      return;
    }

    // 2. Dates validation
    const startDateInput = form.elements.namedItem("startDate") as HTMLInputElement | null;
    const endDateInput = form.elements.namedItem("endDate") as HTMLInputElement | null;
    const sDate = startDateInput?.value;
    const eDate = endDateInput?.value;
    if (sDate && eDate && eDate < sDate) {
      event.preventDefault();
      alert("Дата окончания работы не может быть раньше даты начала.");
      return;
    }

    // 3. RU validation
    const titleRu = (form.elements.namedItem("titleRu") as HTMLInputElement)?.value.trim();
    const slugRu = (form.elements.namedItem("slugRu") as HTMLInputElement)?.value.trim();
    const summaryRu = (form.elements.namedItem("summaryRu") as HTMLTextAreaElement)?.value.trim();
    const descRu = (form.elements.namedItem("descriptionRu") as HTMLTextAreaElement)?.value.trim();

    if (!titleRu || titleRu.length < 3 || !slugRu || !summaryRu || summaryRu.length < 20 || !descRu || descRu.length < 40) {
      if (activeLocale !== "Ru") {
        event.preventDefault();
        setActiveLocale("Ru");
        setTimeout(() => {
          const firstMissing =
            !titleRu || titleRu.length < 3
              ? "titleRu"
              : !slugRu
              ? "slugRu"
              : !summaryRu || summaryRu.length < 20
              ? "summaryRu"
              : "descriptionRu";
          (form.elements.namedItem(firstMissing) as HTMLElement)?.focus();
        }, 50);
        return;
      }
      return;
    }

    // 4. KK validation
    const titleKk = (form.elements.namedItem("titleKk") as HTMLInputElement)?.value.trim();
    const slugKk = (form.elements.namedItem("slugKk") as HTMLInputElement)?.value.trim();
    const summaryKk = (form.elements.namedItem("summaryKk") as HTMLTextAreaElement)?.value.trim();
    const descKk = (form.elements.namedItem("descriptionKk") as HTMLTextAreaElement)?.value.trim();

    if (!titleKk || titleKk.length < 3 || !slugKk || !summaryKk || summaryKk.length < 20 || !descKk || descKk.length < 40) {
      if (activeLocale !== "Kk") {
        event.preventDefault();
        setActiveLocale("Kk");
        setTimeout(() => {
          const firstMissing =
            !titleKk || titleKk.length < 3
              ? "titleKk"
              : !slugKk
              ? "slugKk"
              : !summaryKk || summaryKk.length < 20
              ? "summaryKk"
              : "descriptionKk";
          (form.elements.namedItem(firstMissing) as HTMLElement)?.focus();
        }, 50);
        return;
      }
      return;
    }

    // 5. EN validation (if partly filled)
    const titleEn = (form.elements.namedItem("titleEn") as HTMLInputElement)?.value.trim();
    const slugEn = (form.elements.namedItem("slugEn") as HTMLInputElement)?.value.trim();
    const summaryEn = (form.elements.namedItem("summaryEn") as HTMLTextAreaElement)?.value.trim();
    const descEn = (form.elements.namedItem("descriptionEn") as HTMLTextAreaElement)?.value.trim();
    const resultsEn = (form.elements.namedItem("resultsEn") as HTMLTextAreaElement)?.value.trim();

    const hasAnyEn = Boolean(titleEn || slugEn || summaryEn || descEn || resultsEn);
    if (hasAnyEn) {
      if (!titleEn || titleEn.length < 3 || !slugEn || !summaryEn || summaryEn.length < 20 || !descEn || descEn.length < 40) {
        if (activeLocale !== "En") {
          event.preventDefault();
          setActiveLocale("En");
          setTimeout(() => {
            const firstMissing =
              !titleEn || titleEn.length < 3
                ? "titleEn"
                : !slugEn
                ? "slugEn"
                : !summaryEn || summaryEn.length < 20
                ? "summaryEn"
                : "descriptionEn";
            (form.elements.namedItem(firstMissing) as HTMLElement)?.focus();
          }, 50);
          return;
        }
        return;
      }
    }

    setPending(true);
  };

  // Select options
  const stageOptions = scienceWorkStages.map((stage) => ({
    value: stage,
    label: scienceWorkStageLabels.ru[stage],
  }));

  const fieldOptions = [
    { value: "", label: "Выберите направление" },
    ...options.fields.map((item) => ({ value: item.id, label: item.nameRu })),
  ];
  if (work && !options.fields.some((item) => item.id === work.fieldId)) {
    fieldOptions.push({ value: work.fieldId, label: "Направление недоступно — выберите другое" });
  }

  const organizationOptions = [
    { value: "", label: "Не указана" },
    ...options.organizations.map((item) => ({
      value: item.id,
      label: item.cityRu ? `${item.nameRu} (${item.cityRu})` : item.nameRu,
    })),
  ];
  if (work?.organizationId && !options.organizations.some((item) => item.id === work.organizationId)) {
    organizationOptions.push({ value: work.organizationId, label: "Организация недоступна — выберите другую" });
  }

  const leaderOptions = [
    { value: "", label: "Не указан" },
    ...scientists.map((item) => ({ value: item.id, label: item.name })),
  ];

  // Filter scientists for team list
  const availableTeamScientists = scientists.filter((s) => s.id !== leadScientistId);
  const filteredTeamScientists = availableTeamScientists.filter((s) =>
    !memberSearchQuery.trim() || s.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const basePath = scienceWorkPath(kind);
  const termSingular = kind === "project" ? "научного проекта" : "исследования";

  return (
    <form action={action} onSubmit={handleSubmit} className="article-form wp-editor-form">
      {/* Hidden Cover Media ID */}
      <input type="hidden" name="coverMediaId" value={coverMediaId} />

      {/* TOPBAR: Language Tabs & Submit */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии">
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "Ru"}
              className={`wp-lang-tab ${activeLocale === "Ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("Ru")}
            >
              <span className={`wp-tab-dot ${titles.Ru.trim() ? "is-filled" : ""}`} />
              Русский
            </button>
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "Kk"}
              className={`wp-lang-tab ${activeLocale === "Kk" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("Kk")}
            >
              <span className={`wp-tab-dot ${titles.Kk.trim() ? "is-filled" : ""}`} />
              Қазақша
            </button>
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "En"}
              className={`wp-lang-tab ${activeLocale === "En" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("En")}
            >
              <span className={`wp-tab-dot ${titles.En.trim() ? "is-filled" : ""}`} />
              English <small className="wp-tab-optional">необяз.</small>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          <button type="submit" className="primary-button wp-submit-btn" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            <span>{pending ? "Сохранение…" : submitLabel}</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE: Main Content (Left) & Sidebar (Right) */}
      <div className="wp-editor-workspace">
        {/* MAIN COLUMN */}
        <div className="wp-editor-main">
          {/* RU LOCALE */}
          <LocalePane
            locale="Ru"
            langCode="ru"
            basePath={basePath}
            active={activeLocale === "Ru"}
            title={titles.Ru}
            slug={slugs.Ru}
            summary={summaries.Ru}
            description={descriptions.Ru}
            results={results.Ru}
            onTitleChange={(val) => handleTitleChange("Ru", val)}
            onSlugChange={(val) => handleSlugChange("Ru", val)}
            onRegenerateSlug={() => handleRegenerateSlug("Ru")}
            onSummaryChange={(val) => setSummaries((prev) => ({ ...prev, Ru: val }))}
            onDescriptionChange={(val) => setDescriptions((prev) => ({ ...prev, Ru: val }))}
            onResultsChange={(val) => setResults((prev) => ({ ...prev, Ru: val }))}
            pending={pending}
            termSingular={termSingular}
          />

          {/* KK LOCALE */}
          <LocalePane
            locale="Kk"
            langCode="kk"
            basePath={basePath}
            active={activeLocale === "Kk"}
            title={titles.Kk}
            slug={slugs.Kk}
            summary={summaries.Kk}
            description={descriptions.Kk}
            results={results.Kk}
            onTitleChange={(val) => handleTitleChange("Kk", val)}
            onSlugChange={(val) => handleSlugChange("Kk", val)}
            onRegenerateSlug={() => handleRegenerateSlug("Kk")}
            onSummaryChange={(val) => setSummaries((prev) => ({ ...prev, Kk: val }))}
            onDescriptionChange={(val) => setDescriptions((prev) => ({ ...prev, Kk: val }))}
            onResultsChange={(val) => setResults((prev) => ({ ...prev, Kk: val }))}
            pending={pending}
            termSingular={termSingular}
          />

          {/* EN LOCALE (OPTIONAL) */}
          <LocalePane
            locale="En"
            langCode="en"
            basePath={basePath}
            active={activeLocale === "En"}
            title={titles.En}
            slug={slugs.En}
            summary={summaries.En}
            description={descriptions.En}
            results={results.En}
            onTitleChange={(val) => handleTitleChange("En", val)}
            onSlugChange={(val) => handleSlugChange("En", val)}
            onRegenerateSlug={() => handleRegenerateSlug("En")}
            onSummaryChange={(val) => setSummaries((prev) => ({ ...prev, En: val }))}
            onDescriptionChange={(val) => setDescriptions((prev) => ({ ...prev, En: val }))}
            onResultsChange={(val) => setResults((prev) => ({ ...prev, En: val }))}
            pending={pending}
            termSingular={termSingular}
            optional
          />
        </div>

        {/* SIDEBAR COLUMN */}
        <aside className="wp-editor-sidebar">
          {/* Card: Publication & Status */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Публикация и статус</summary>
            <div className="wp-sidebar-card-body">
              {work ? (
                <div className="wp-sidebar-meta-row">
                  <span>Текущий статус:</span>
                  <span className={`status-badge status-${work.status}`} style={{ fontSize: "11px" }}>
                    {scienceWorkStatusLabels[work.status]}
                  </span>
                </div>
              ) : (
                <div className="wp-sidebar-meta-row">
                  <span>Новая запись:</span>
                  <span className="status-badge status-draft" style={{ fontSize: "11px" }}>
                    Черновик
                  </span>
                </div>
              )}

              {work?.status === "published" && work.translations?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>Публичные страницы:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {work.translations.map((t) => (
                      <Link
                        key={t.locale}
                        href={`/${t.locale}${basePath}/${t.slug}`}
                        target="_blank"
                        className="wp-preview-link"
                        style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <span>{t.locale.toUpperCase()}</span>
                        <ArrowUpRight size={12} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: "8px" }}>
                <button
                  type="submit"
                  className="primary-button wp-submit-btn"
                  disabled={pending}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Save size={16} aria-hidden="true" />
                  <span>{pending ? "Сохранение…" : submitLabel}</span>
                </button>
              </div>
            </div>
          </details>

          {/* Card: Cover Image */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Обложка {termSingular}</summary>
            <div className="wp-sidebar-card-body">
              {coverDisplayUrl ? (
                <div className="wp-cover-preview-card">
                  <div
                    className="wp-cover-thumbnail-box"
                    style={{
                      width: "100%",
                      height: "140px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      margin: "0 auto",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverDisplayUrl}
                      alt="Обложка"
                      className="wp-cover-image"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div className="wp-cover-info" style={{ textAlign: "center", marginTop: "8px" }}>
                    <p className="wp-cover-filename" title={selectedCover?.fileName ?? "Обложка"}>
                      {selectedCover?.fileName ?? "Обложка"}
                    </p>
                    {selectedCover?.width && selectedCover?.height ? (
                      <small className="wp-cover-dimensions">
                        {selectedCover.width} × {selectedCover.height} px
                      </small>
                    ) : null}
                  </div>
                  <div className="wp-cover-actions" style={{ justifyContent: "center" }}>
                    <button
                      type="button"
                      className="secondary-button wp-cover-btn"
                      onClick={() => setIsMediaModalOpen(true)}
                      disabled={pending}
                    >
                      Сменить обложку
                    </button>
                    <button
                      type="button"
                      className="danger-button wp-cover-btn wp-cover-remove"
                      onClick={() => setCoverMediaId("")}
                      disabled={pending}
                      title="Удалить обложку"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Удалить</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="wp-cover-empty-dropzone"
                  onClick={() => setIsMediaModalOpen(true)}
                  disabled={pending}
                  style={{ padding: "24px 16px" }}
                >
                  <ImageIcon className="wp-cover-icon" aria-hidden="true" />
                  <span>Выбрать обложку из медиатеки</span>
                  <small>Рекомендуется горизонтальное изображение 16:9</small>
                </button>
              )}
            </div>
          </details>

          {/* Card: Research Parameters */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Параметры и классификация</summary>
            <div className="wp-sidebar-card-body">
              <div className="wp-field-group">
                <span className="wp-field-label">Этап работы</span>
                <CustomSelect
                  name="stage"
                  defaultValue={work?.stage ?? "planned"}
                  options={stageOptions}
                  disabled={pending}
                />
              </div>

              <div className="wp-field-group">
                <span className="wp-field-label">Научное направление *</span>
                <CustomSelect
                  name="fieldId"
                  defaultValue={work?.fieldId ?? ""}
                  options={fieldOptions}
                  disabled={pending}
                />
                {!options.fields.length ? (
                  <p className="field-hint" style={{ marginTop: "4px" }}>
                    Добавьте направление в{" "}
                    <Link href="/admin/science/scientists/taxonomy" target="_blank">
                      справочниках сообщества ↗
                    </Link>
                  </p>
                ) : null}
              </div>

              <div className="wp-field-group">
                <span className="wp-field-label">Организация</span>
                <CustomSelect
                  name="organizationId"
                  defaultValue={work?.organizationId ?? ""}
                  options={organizationOptions}
                  disabled={pending}
                />
              </div>

              {/* Dates in 2 Columns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="wp-field-group">
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span className="wp-field-label">Дата начала</span>
                    <input
                      type="date"
                      name="startDate"
                      defaultValue={work?.startDate ?? ""}
                      disabled={pending}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                      }}
                    />
                  </label>
                </div>
                <div className="wp-field-group">
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span className="wp-field-label">Дата окончания</span>
                    <input
                      type="date"
                      name="endDate"
                      defaultValue={work?.endDate ?? ""}
                      disabled={pending}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Links & Identifiers */}
              <div className="wp-field-group">
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span className="wp-field-label">Сайт / публикация</span>
                  <input
                    type="url"
                    name="externalUrl"
                    defaultValue={work?.externalUrl ?? ""}
                    maxLength={500}
                    placeholder="https://..."
                    disabled={pending}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                </label>
              </div>

              <div className="wp-field-group">
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span className="wp-field-label">DOI исследования</span>
                  <input
                    name="doi"
                    defaultValue={work?.doi ?? ""}
                    maxLength={200}
                    placeholder="10.1234/example"
                    disabled={pending}
                    pattern="10\.\d{4,9}/\S+"
                    style={{
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                  <small style={{ color: "#64748b", fontSize: "11px" }}>Например: 10.1000/182</small>
                </label>
              </div>
            </div>
          </details>

          {/* Card: Team Leader */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Научный руководитель</summary>
            <div className="wp-sidebar-card-body">
              <div className="wp-field-group">
                <span className="wp-field-label">Руководитель команды</span>
                <CustomSelect
                  name="leadScientistId"
                  defaultValue={leadScientistId}
                  options={leaderOptions}
                  onChange={handleLeaderChange}
                  disabled={pending}
                />
                <small style={{ color: "#64748b", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Руководитель автоматически исключается из списка рядовых участников.
                </small>
              </div>
            </div>
          </details>

          {/* Card: Team Members */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Участники команды</summary>
            <div className="wp-sidebar-card-body">
              {/* Hidden inputs for selected members currently filtered out by search */}
              {Array.from(selectedMemberIds)
                .filter((id) => !filteredTeamScientists.some((s) => s.id === id))
                .map((id) => (
                  <input key={id} type="hidden" name="memberIds" value={id} />
                ))}

              <div className="wp-field-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span className="wp-field-label" style={{ margin: 0 }}>Участники</span>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                    Выбрано: {selectedMemberIds.size}
                  </span>
                </div>

                <div style={{ position: "relative", marginBottom: "8px" }}>
                  <label htmlFor={memberSearchId} className="visually-hidden">
                    Поиск по участникам
                  </label>
                  <input
                    id={memberSearchId}
                    type="search"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Найти учёного..."
                    disabled={pending}
                    style={{
                      width: "100%",
                      padding: "6px 10px 6px 28px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12.5px",
                      boxSizing: "border-box",
                    }}
                  />
                  <Search
                    size={13}
                    style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
                    aria-hidden="true"
                  />
                </div>

                {filteredTeamScientists.length > 0 ? (
                  <div
                    className="wp-chip-group"
                    style={{
                      maxHeight: "220px",
                      overflowY: "auto",
                      padding: "2px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    {filteredTeamScientists.map((s) => {
                      const isChecked = selectedMemberIds.has(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`wp-chip-label ${isChecked ? "is-checked" : ""}`}
                          style={{
                            display: "inline-flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            name="memberIds"
                            value={s.id}
                            checked={isChecked}
                            disabled={pending}
                            onChange={(e) => toggleMember(s.id, e.target.checked)}
                            style={{ margin: 0, flexShrink: 0 }}
                          />
                          <span style={{ fontSize: "12px", lineHeight: "1.3" }}>{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <small style={{ color: "#64748b", fontSize: "12px" }}>
                    {availableTeamScientists.length === 0
                      ? "Нет доступных учёных для добавления."
                      : "Учёные не найдены."}
                  </small>
                )}
              </div>
            </div>
          </details>
        </aside>
      </div>

      {/* MEDIA SELECTOR MODAL */}
      {isMediaModalOpen ? (
        <div className="wp-modal-backdrop" onClick={() => setIsMediaModalOpen(false)}>
          <div className="wp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-header">
              <h3>Выбор обложки {termSingular}</h3>
              <button
                type="button"
                className="wp-modal-close-btn"
                onClick={() => setIsMediaModalOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="wp-modal-toolbar">
              <label htmlFor={mediaSearchId} className="visually-hidden">
                Поиск по названию файла
              </label>
              <input
                id={mediaSearchId}
                type="search"
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                placeholder="Поиск по названию файла или описанию..."
                className="wp-modal-search-input"
              />
              <Link href="/admin/content/media" target="_blank" className="secondary-button wp-modal-upload-link">
                Медиатека ↗
              </Link>
            </div>

            <div className="wp-modal-grid">
              {filteredMedia.length > 0 ? (
                filteredMedia.map((asset) => (
                  <div
                    key={asset.id}
                    className={`wp-modal-item ${asset.id === coverMediaId ? "is-selected" : ""}`}
                    onClick={() => {
                      setCoverMediaId(asset.id);
                      setIsMediaModalOpen(false);
                    }}
                  >
                    <div className="wp-modal-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.previewUrl ?? ""} alt={asset.fileName} loading="lazy" />
                    </div>
                    <span className="wp-modal-filename" title={asset.fileName}>
                      {asset.fileName}
                    </span>
                    {asset.id === coverMediaId ? <span className="wp-modal-tag">Выбрано</span> : null}
                  </div>
                ))
              ) : (
                <div className="wp-modal-empty">
                  {media.length === 0
                    ? "В медиатеке пока нет загруженных изображений."
                    : "Изображения по запросу не найдены."}
                </div>
              )}
            </div>

            <div className="wp-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setIsMediaModalOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

type LocalePaneProps = {
  locale: "Ru" | "Kk" | "En";
  langCode: "ru" | "kk" | "en";
  basePath: string;
  active: boolean;
  title: string;
  slug: string;
  summary: string;
  description: string;
  results: string;
  onTitleChange: (val: string) => void;
  onSlugChange: (val: string) => void;
  onRegenerateSlug: () => void;
  onSummaryChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onResultsChange: (val: string) => void;
  pending: boolean;
  termSingular: string;
  optional?: boolean;
};

function LocalePane({
  locale,
  langCode,
  basePath,
  active,
  title,
  slug,
  summary,
  description,
  results,
  onTitleChange,
  onSlugChange,
  onRegenerateSlug,
  onSummaryChange,
  onDescriptionChange,
  onResultsChange,
  pending,
  termSingular,
  optional = false,
}: LocalePaneProps) {
  const isRequired = !optional;

  return (
    <div
      className={`wp-locale-pane ${active ? "is-active" : ""}`}
      style={{
        display: active ? "flex" : "none",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Title Input */}
      <div className="wp-title-section">
        <label className="visually-hidden" htmlFor={`title${locale}`}>
          Название ({locale})
        </label>
        <input
          id={`title${locale}`}
          name={`title${locale}`}
          value={title}
          required={isRequired}
          minLength={3}
          maxLength={240}
          className="wp-title-input"
          disabled={pending}
          placeholder={
            locale === "Ru"
              ? `Название ${termSingular} (RU)...`
              : locale === "Kk"
              ? `${termSingular === "научного проекта" ? "Ғылыми жобаның" : "Зерттеудің"} атауы (KK)...`
              : `Title of the ${termSingular === "научного проекта" ? "project" : "research"} (EN)...`
          }
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      {/* Permalink Bar */}
      <div className="wp-permalink-bar">
        <span className="wp-permalink-prefix">
          Постоянная ссылка: smu.kz/{langCode}{basePath}/
        </span>
        <input
          name={`slug${locale}`}
          value={slug}
          required={isRequired}
          minLength={2}
          maxLength={160}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="latin-slug-url"
          className="wp-permalink-input"
          disabled={pending}
          onChange={(e) => onSlugChange(e.target.value)}
        />
        {title.trim() ? (
          <button
            type="button"
            className="wp-permalink-refresh-btn"
            onClick={onRegenerateSlug}
            title="Сгенерировать ссылку из названия"
            disabled={pending}
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Обновить</span>
          </button>
        ) : null}
      </div>

      {/* Summary (Excerpt) */}
      <div className="wp-excerpt-section">
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="wp-field-label">Краткое описание (анонс для каталога) {!optional ? "*" : ""}</span>
            <span style={{ fontSize: "11px", color: summary.length >= 20 ? "#64748b" : "#e11d48" }}>
              {summary.length} / 800 {summary.length < 20 && !optional ? "(минимум 20)" : ""}
            </span>
          </div>
          <textarea
            name={`summary${locale}`}
            value={summary}
            required={isRequired}
            minLength={isRequired ? 20 : undefined}
            maxLength={800}
            rows={3}
            className="wp-excerpt-textarea"
            disabled={pending}
            placeholder={
              locale === "Ru"
                ? "Краткое описание сути работы, ключевой проблемы и ожидаемых результатов..."
                : locale === "Kk"
                ? "Жұмыстың мәні, негізгі мәселесі мен күтілетін нәтижелері туралы қысқаша мазмұны..."
                : "Brief summary of the work, core problem, and expected outcomes..."
            }
            onChange={(e) => onSummaryChange(e.target.value)}
          />
        </label>
      </div>

      {/* Description & Goals */}
      <div
        className="wp-editor-content-box"
        style={{
          background: "#fff",
          border: "1px solid #dce8ed",
          borderRadius: "10px",
          padding: "18px",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="wp-field-label" style={{ fontWeight: 650, color: "#1e293b", fontSize: "14px" }}>
              Описание и цели {!optional ? "*" : ""}
            </span>
            <span style={{ fontSize: "11px", color: description.length >= 40 ? "#64748b" : "#e11d48" }}>
              {description.length} / 30000 {description.length < 40 && !optional ? "(минимум 40)" : ""}
            </span>
          </div>
          <textarea
            name={`description${locale}`}
            value={description}
            required={isRequired}
            minLength={isRequired ? 40 : undefined}
            maxLength={30000}
            rows={10}
            disabled={pending}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              lineHeight: "1.6",
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
            placeholder={
              locale === "Ru"
                ? "Подробное описание работы, научная новизна, методология, используемые подходы..."
                : locale === "Kk"
                ? "Жұмыстың толық сипаттамасы, ғылыми жаңалығы, әдіснамасы, қолданылатын тәсілдер..."
                : "Detailed description of the work, scientific novelty, methodology, and approaches..."
            }
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </label>
        <small style={{ color: "#64748b", fontSize: "12px", marginTop: "4px", display: "block" }}>
          Разделяйте смысловые абзацы пустой строкой (Enter дважды).
        </small>
      </div>

      {/* Results */}
      <div
        className="wp-editor-content-box"
        style={{
          background: "#fff",
          border: "1px solid #dce8ed",
          borderRadius: "10px",
          padding: "18px",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="wp-field-label" style={{ fontWeight: 650, color: "#1e293b", fontSize: "14px" }}>
              Полученные результаты
            </span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {results.length} / 20000
            </span>
          </div>
          <textarea
            name={`results${locale}`}
            value={results}
            maxLength={20000}
            rows={6}
            disabled={pending}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              lineHeight: "1.6",
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
            placeholder={
              locale === "Ru"
                ? "Опубликованные статьи, зарегистрированные патенты, внедрения или промежуточные итоги..."
                : locale === "Kk"
                ? "Жарияланған мақалалар, тіркелген патенттер, енгізілімдер немесе аралық нәтижелер..."
                : "Published articles, patents, implementations, or milestone achievements..."
            }
            onChange={(e) => onResultsChange(e.target.value)}
          />
        </label>
        <small style={{ color: "#64748b", fontSize: "12px", marginTop: "4px", display: "block" }}>
          Заполняется по мере получения результатов или по завершении работы.
        </small>
      </div>
    </div>
  );
}
