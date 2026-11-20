"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Image as ImageIcon, RotateCcw, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { CustomSelect } from "@/components/articles/CustomSelect";
import { generateSlug } from "@/lib/articles/slug";
import {
  collaborationKeys,
  collaborationLabels,
  scientistLinkLabels,
  scientistLinkTypes,
  verificationLabels,
} from "@/lib/scientists/profile";
import type { MediaAsset } from "@/types/domain/media";
import type { ScientistProfile, ScientistTaxonomy } from "@/types/domain/scientist";

type ScientistFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  profile?: ScientistProfile;
  taxonomy: ScientistTaxonomy;
  media: MediaAsset[];
  submitLabel?: string;
};

export function ScientistForm({
  action,
  profile,
  taxonomy,
  media,
  submitLabel = "Сохранить профиль",
}: ScientistFormProps) {
  const mediaSearchId = useId();
  const [activeLocale, setActiveLocale] = useState<"Ru" | "Kk" | "En">("Ru");
  const [pending, setPending] = useState(false);
  const [avatarMediaId, setAvatarMediaId] = useState<string>(() => profile?.avatarMediaId ?? "");
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");

  const ru = profile?.translations.find((item) => item.locale === "ru");
  const kk = profile?.translations.find((item) => item.locale === "kk");
  const en = profile?.translations.find((item) => item.locale === "en");
  const selectedFields = new Set(profile?.fields.map((item) => item.id) ?? []);

  const [names, setNames] = useState({
    Ru: ru?.fullName ?? "",
    Kk: kk?.fullName ?? "",
    En: en?.fullName ?? "",
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

  const handleNameChange = (locale: "Ru" | "Kk" | "En", value: string) => {
    setNames((prev) => ({ ...prev, [locale]: value }));
    if (!isSlugTouched[locale]) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(value) }));
    }
  };

  const handleSlugChange = (locale: "Ru" | "Kk" | "En", value: string) => {
    setSlugs((prev) => ({ ...prev, [locale]: value }));
    setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
  };

  const handleRegenerateSlug = (locale: "Ru" | "Kk" | "En") => {
    const autoSlug = generateSlug(names[locale]);
    setSlugs((prev) => ({ ...prev, [locale]: autoSlug }));
    setIsSlugTouched((prev) => ({ ...prev, [locale]: false }));
  };

  const selectedAvatar = media.find((m) => m.id === avatarMediaId);
  const avatarDisplayUrl = selectedAvatar?.previewUrl || (avatarMediaId === profile?.avatarMediaId ? profile?.avatarUrl : null);

  const filteredMedia = media.filter(
    (asset) =>
      asset.previewUrl &&
      asset.status === "ready" &&
      !asset.deletedAt &&
      (!mediaSearchQuery.trim() ||
        asset.fileName.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
        (asset.altRu && asset.altRu.toLowerCase().includes(mediaSearchQuery.toLowerCase())))
  );

  const organizationOptions = [
    { value: "", label: "Не указана" },
    ...taxonomy.organizations.map((org) => ({
      value: org.id,
      label: org.cityRu ? `${org.nameRu} (${org.cityRu})` : org.nameRu,
    })),
  ];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    // Check RU
    const nameRu = (form.elements.namedItem("fullNameRu") as HTMLInputElement)?.value.trim();
    const slugRu = (form.elements.namedItem("slugRu") as HTMLInputElement)?.value.trim();
    const posRu = (form.elements.namedItem("positionRu") as HTMLInputElement)?.value.trim();
    const bioRu = (form.elements.namedItem("biographyRu") as HTMLTextAreaElement)?.value.trim();

    if (!nameRu || !slugRu || !posRu || !bioRu) {
      if (activeLocale !== "Ru") {
        event.preventDefault();
        setActiveLocale("Ru");
        setTimeout(() => {
          const firstMissing = !nameRu ? "fullNameRu" : !slugRu ? "slugRu" : !posRu ? "positionRu" : "biographyRu";
          (form.elements.namedItem(firstMissing) as HTMLElement)?.focus();
        }, 50);
        return;
      }
      return;
    }

    // Check KK
    const nameKk = (form.elements.namedItem("fullNameKk") as HTMLInputElement)?.value.trim();
    const slugKk = (form.elements.namedItem("slugKk") as HTMLInputElement)?.value.trim();
    const posKk = (form.elements.namedItem("positionKk") as HTMLInputElement)?.value.trim();
    const bioKk = (form.elements.namedItem("biographyKk") as HTMLTextAreaElement)?.value.trim();

    if (!nameKk || !slugKk || !posKk || !bioKk) {
      event.preventDefault();
      setActiveLocale("Kk");
      setTimeout(() => {
        const firstMissing = !nameKk ? "fullNameKk" : !slugKk ? "slugKk" : !posKk ? "positionKk" : "biographyKk";
        (form.elements.namedItem(firstMissing) as HTMLElement)?.focus();
      }, 50);
      return;
    }

    setPending(true);
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="article-form wp-editor-form">
      {profile ? <input type="hidden" name="expectedContentVersion" value={profile.contentVersion} /> : null}
      <input type="hidden" name="avatarMediaId" value={avatarMediaId} />

      {/* TOPBAR: Language Tabs & Quick Save Action */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии профиля">
            <button
              type="button"
              role="tab"
              aria-selected={activeLocale === "Ru"}
              className={`wp-lang-tab ${activeLocale === "Ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("Ru")}
            >
              <span className={`wp-tab-dot ${names.Ru.trim() ? "is-filled" : ""}`} />
              Русский
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLocale === "Kk"}
              className={`wp-lang-tab ${activeLocale === "Kk" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("Kk")}
            >
              <span className={`wp-tab-dot ${names.Kk.trim() ? "is-filled" : ""}`} />
              Қазақша
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLocale === "En"}
              className={`wp-lang-tab ${activeLocale === "En" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("En")}
            >
              <span className={`wp-tab-dot ${names.En.trim() ? "is-filled" : ""}`} />
              English
              <span className="wp-tab-optional">опционально</span>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          {profile?.translations?.length ? (
            <div className="wp-preview-group" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Профиль:</span>
              {profile.translations.map((t) => (
                <Link
                  key={t.locale}
                  href={`/${t.locale}/scientists/${t.slug}`}
                  target="_blank"
                  className="wp-preview-link"
                  style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "3px" }}
                >
                  <span>{t.locale.toUpperCase()}</span>
                  <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : null}

          <button type="submit" className="primary-button wp-submit-btn" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            <span>{pending ? "Сохранение…" : submitLabel}</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE: Left Column (Content) & Right Column (Sidebar) */}
      <div className="wp-editor-workspace">
        {/* MAIN COLUMN */}
        <div className="wp-editor-main">
          {/* RU PANE */}
          <LocalePane
            locale="Ru"
            langCode="ru"
            active={activeLocale === "Ru"}
            value={ru}
            fullName={names.Ru}
            slug={slugs.Ru}
            onNameChange={(val) => handleNameChange("Ru", val)}
            onSlugChange={(val) => handleSlugChange("Ru", val)}
            onRegenerateSlug={() => handleRegenerateSlug("Ru")}
            pending={pending}
          />

          {/* KK PANE */}
          <LocalePane
            locale="Kk"
            langCode="kk"
            active={activeLocale === "Kk"}
            value={kk}
            fullName={names.Kk}
            slug={slugs.Kk}
            onNameChange={(val) => handleNameChange("Kk", val)}
            onSlugChange={(val) => handleSlugChange("Kk", val)}
            onRegenerateSlug={() => handleRegenerateSlug("Kk")}
            pending={pending}
          />

          {/* EN PANE (OPTIONAL) */}
          <LocalePane
            locale="En"
            langCode="en"
            active={activeLocale === "En"}
            value={en}
            fullName={names.En}
            slug={slugs.En}
            onNameChange={(val) => handleNameChange("En", val)}
            onSlugChange={(val) => handleSlugChange("En", val)}
            onRegenerateSlug={() => handleRegenerateSlug("En")}
            pending={pending}
            optional
          />
        </div>

        {/* SIDEBAR COLUMN */}
        <aside className="wp-editor-sidebar">
          {/* Card: Status & Visibility */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Публикация и статус</summary>
            <div className="wp-sidebar-card-body">
              <PublicToggle defaultChecked={profile?.isPublic ?? true} disabled={pending} />

              {profile ? (
                <div className="wp-sidebar-meta-row" style={{ marginTop: "4px" }}>
                  <span>Статус верификации:</span>
                  <span className={`status-badge status-${profile.status}`} style={{ fontSize: "11px" }}>
                    {verificationLabels[profile.verificationStatus]}
                  </span>
                </div>
              ) : null}

              {profile?.translations?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>Публичные ссылки:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {profile.translations.map((t) => (
                      <Link
                        key={t.locale}
                        href={`/${t.locale}/scientists/${t.slug}`}
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

              <div style={{ marginTop: "6px" }}>
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

          {/* Card: Avatar Image */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Фотография (Аватар)</summary>
            <div className="wp-sidebar-card-body">
              {avatarDisplayUrl ? (
                <div className="wp-cover-preview-card">
                  <div
                    className="wp-cover-thumbnail-box"
                    style={{
                      width: "130px",
                      height: "130px",
                      borderRadius: "14px",
                      overflow: "hidden",
                      margin: "0 auto",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarDisplayUrl}
                      alt="Аватар учёного"
                      className="wp-cover-image"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div className="wp-cover-info" style={{ textAlign: "center", marginTop: "8px" }}>
                    <p className="wp-cover-filename" title={selectedAvatar?.fileName ?? "Фото профиля"}>
                      {selectedAvatar?.fileName ?? "Фото профиля"}
                    </p>
                    {selectedAvatar?.width && selectedAvatar?.height ? (
                      <small className="wp-cover-dimensions">
                        {selectedAvatar.width} × {selectedAvatar.height} px
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
                      Сменить фото
                    </button>
                    <button
                      type="button"
                      className="danger-button wp-cover-btn wp-cover-remove"
                      onClick={() => setAvatarMediaId("")}
                      disabled={pending}
                      title="Удалить фото"
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
                  style={{ padding: "26px 16px" }}
                >
                  <ImageIcon className="wp-cover-icon" aria-hidden="true" />
                  <span>Выбрать фото из медиатеки</span>
                  <small>Рекомендуется квадратное портретное фото</small>
                </button>
              )}
            </div>
          </details>

          {/* Card: Organization & Taxonomy */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Организация и специализация</summary>
            <div className="wp-sidebar-card-body">
              <div className="wp-field-group">
                <span className="wp-field-label">Организация</span>
                <CustomSelect
                  name="organizationId"
                  defaultValue={profile?.organizationId ?? ""}
                  options={organizationOptions}
                  disabled={pending}
                />
              </div>

              <div className="wp-field-group">
                <span className="wp-field-label">Научные направления</span>
                {taxonomy.fields.length ? (
                  <div className="wp-chip-group">
                    {taxonomy.fields.map((field) => (
                      <ChipCheckbox
                        key={field.id}
                        name="fieldIds"
                        value={field.id}
                        defaultChecked={selectedFields.has(field.id)}
                        label={field.nameRu}
                        disabled={pending}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="field-hint">
                    Добавьте направления в разделе{" "}
                    <Link href="/admin/science/scientists/taxonomy" target="_blank">
                      «Справочники» ↗
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className="wp-field-group">
                <span className="wp-field-label">Открыт к взаимодействию</span>
                <div className="wp-chip-group">
                  {collaborationKeys.map((key, index) => (
                    <ChipCheckbox
                      key={key}
                      name={"collaboration_" + key}
                      value="yes"
                      defaultChecked={profile?.collaboration[key] ?? false}
                      label={collaborationLabels.ru[index]}
                      disabled={pending}
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>

          {/* Card: Contacts & External Links */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Контакты и профили</summary>
            <div className="wp-sidebar-card-body">
              <div className="wp-field-group">
                <span className="wp-field-label">Публичный e-mail</span>
                <input
                  type="email"
                  name="publicEmail"
                  defaultValue={profile?.publicEmail ?? ""}
                  maxLength={254}
                  placeholder="doctor@smu.edu.kz"
                  disabled={pending}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                />
              </div>

              {scientistLinkTypes.map((type) => {
                const linkValue = profile?.links.find((l) => l.type === type)?.url ?? "";
                const linkDetails: Record<typeof type, { placeholder: string; hint: string }> = {
                  orcid: {
                    placeholder: "https://orcid.org/0000-0000-0000-0000",
                    hint: "Формат: https://orcid.org/XXXX-XXXX-XXXX-XXXX",
                  },
                  google_scholar: {
                    placeholder: "https://scholar.google.com/citations?user=...",
                    hint: "Ссылка на профиль в Google Scholar",
                  },
                  scopus: {
                    placeholder: "https://www.scopus.com/authid/detail.uri?authorId=...",
                    hint: "Ссылка на автора в Scopus",
                  },
                  researchgate: {
                    placeholder: "https://www.researchgate.net/profile/...",
                    hint: "Ссылка на профиль в ResearchGate",
                  },
                  linkedin: {
                    placeholder: "https://www.linkedin.com/in/...",
                    hint: "Ссылка на профиль в LinkedIn",
                  },
                  website: {
                    placeholder: "https://example.kz",
                    hint: "Персональный или лабораторный сайт",
                  },
                };

                return (
                  <div className="wp-field-group" key={type}>
                    <span className="wp-field-label">{scientistLinkLabels[type]}</span>
                    <input
                      type="url"
                      name={"link_" + type}
                      defaultValue={linkValue}
                      maxLength={500}
                      placeholder={linkDetails[type].placeholder}
                      disabled={pending}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                    />
                    <small style={{ color: "#64748b", fontSize: "11px" }}>{linkDetails[type].hint}</small>
                  </div>
                );
              })}
            </div>
          </details>
        </aside>
      </div>

      {/* MEDIA PICKER MODAL */}
      {isMediaModalOpen ? (
        <div className="wp-modal-backdrop" onClick={() => setIsMediaModalOpen(false)}>
          <div className="wp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-header">
              <h3>Выбор фотографии учёного</h3>
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
                    className={`wp-modal-item ${asset.id === avatarMediaId ? "is-selected" : ""}`}
                    onClick={() => {
                      setAvatarMediaId(asset.id);
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
                    {asset.id === avatarMediaId ? <span className="wp-modal-tag">Выбрано</span> : null}
                  </div>
                ))
              ) : (
                <div className="wp-modal-empty">
                  {media.length === 0 ? "В медиатеке пока нет фотографий для аватара." : "Изображения по запросу не найдены."}
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
  active: boolean;
  value?: ScientistProfile["translations"][number];
  fullName: string;
  slug: string;
  onNameChange: (val: string) => void;
  onSlugChange: (val: string) => void;
  onRegenerateSlug: () => void;
  pending: boolean;
  optional?: boolean;
};

function LocalePane({
  locale,
  langCode,
  active,
  value,
  fullName,
  slug,
  onNameChange,
  onSlugChange,
  onRegenerateSlug,
  pending,
  optional = false,
}: LocalePaneProps) {
  const isRequired = active && !optional;

  return (
    <div
      className={`wp-locale-pane ${active ? "is-active" : ""}`}
      style={{ display: active ? "flex" : "none", flexDirection: "column", gap: "18px" }}
    >
      {/* Full Name */}
      <div className="wp-title-section">
        <label className="visually-hidden" htmlFor={`fullName${locale}`}>
          Полное имя ({locale})
        </label>
        <input
          id={`fullName${locale}`}
          name={`fullName${locale}`}
          value={fullName}
          required={isRequired}
          minLength={3}
          maxLength={180}
          disabled={pending}
          className="wp-title-input"
          placeholder={
            locale === "Ru"
              ? "Введите полное имя учёного (RU)..."
              : locale === "Kk"
              ? "Ғалымның толық аты-жөнін енгізіңіз (KK)..."
              : "Enter scientist's full name (EN)..."
          }
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      {/* Permalink Bar */}
      <div className="wp-permalink-bar">
        <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/{langCode}/scientists/</span>
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
        {fullName.trim() ? (
          <button
            type="button"
            className="wp-permalink-refresh-btn"
            onClick={onRegenerateSlug}
            title="Сгенерировать ссылку из имени"
            disabled={pending}
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Обновить</span>
          </button>
        ) : null}
      </div>

      {/* Position & Degree in 2 Columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div className="wp-field-group">
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className="wp-field-label">Должность {!optional ? "*" : ""}</span>
            <input
              name={`position${locale}`}
              defaultValue={value?.position ?? ""}
              required={isRequired}
              minLength={2}
              maxLength={180}
              disabled={pending}
              placeholder={
                locale === "Ru"
                  ? "Главный научный сотрудник, зав. кафедрой"
                  : locale === "Kk"
                  ? "Бас ғылыми қызметкер, кафедра меңгерушісі"
                  : "Chief Researcher, Head of Department"
              }
              style={{
                padding: "9px 13px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            />
          </label>
        </div>

        <div className="wp-field-group">
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className="wp-field-label">Учёная степень</span>
            <input
              name={`academicDegree${locale}`}
              defaultValue={value?.academicDegree ?? ""}
              maxLength={180}
              disabled={pending}
              placeholder={
                locale === "Ru"
                  ? "д.м.н., профессор, PhD"
                  : locale === "Kk"
                  ? "м.ғ.д., профессор, PhD"
                  : "MD, PhD, Professor"
              }
              style={{
                padding: "9px 13px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            />
          </label>
        </div>
      </div>

      {/* Short Bio */}
      <div className="wp-excerpt-section">
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span className="wp-field-label">
            Краткое описание (анонс для карточки в каталоге) {!optional ? "*" : ""}
          </span>
          <textarea
            name={`shortBio${locale}`}
            defaultValue={value?.shortBio ?? ""}
            required={isRequired}
            minLength={20}
            maxLength={600}
            rows={3}
            disabled={pending}
            className="wp-excerpt-textarea"
            placeholder={
              locale === "Ru"
                ? "Краткая информация об учёном, специализации и ключевых достижениях (от 20 до 600 знаков)..."
                : locale === "Kk"
                ? "Ғалым, оның мамандануы мен негізгі жетістіктері туралы қысқаша ақпарат (20-дан 600 таңбаға дейін)..."
                : "Brief information about the scientist, area of expertise, and key achievements..."
            }
          />
          <small style={{ color: "#64748b", fontSize: "11px" }}>
            Отображается в общем каталоге и результатах поиска (от 20 до 600 знаков).
          </small>
        </label>
      </div>

      {/* Full Biography */}
      <div style={{ background: "#ffffff", border: "1px solid #dce8ed", borderRadius: "10px", padding: "18px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span className="wp-field-label" style={{ fontWeight: 650, color: "#1e293b", fontSize: "14px" }}>
            Биография и научная деятельность {!optional ? "*" : ""}
          </span>
          <textarea
            name={`biography${locale}`}
            defaultValue={value?.biography ?? ""}
            required={isRequired}
            minLength={40}
            maxLength={20000}
            rows={12}
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
                ? "Подробная биография: образование, научные интересы, опыт исследований, основные публикации, членство в научных советах..."
                : locale === "Kk"
                ? "Толық өмірбаян: білімі, ғылыми қызығушылықтары, зерттеу тәжірибесі, негізгі еңбектері..."
                : "Detailed biography: education, research interests, career milestones, major publications..."
            }
          />
        </label>
        <small style={{ color: "#64748b", fontSize: "12px", marginTop: "6px", display: "block" }}>
          Разделяйте смысловые абзацы пустой строкой (Enter дважды).
        </small>
      </div>
    </div>
  );
}

function ChipCheckbox({
  name,
  value,
  defaultChecked,
  label,
  disabled,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  label: string;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked ?? false);

  return (
    <label
      className={`wp-chip-label ${checked ? "is-checked" : ""}`}
      style={{
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "7px",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        value={value ?? "yes"}
        checked={checked}
        disabled={disabled}
        onChange={(e) => setChecked(e.target.checked)}
        style={{
          margin: 0,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: "12px", lineHeight: "1.3" }}>{label}</span>
    </label>
  );
}

function PublicToggle({ defaultChecked, disabled }: { defaultChecked?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked ?? true);

  return (
    <label className={`wp-public-toggle-card ${checked ? "is-public" : "is-private"}`}>
      <input
        type="checkbox"
        name="isPublic"
        value="yes"
        checked={checked}
        disabled={disabled}
        onChange={(e) => setChecked(e.target.checked)}
        style={{ display: "none" }}
      />
      <div className="wp-public-toggle-indicator" />
      <div className="wp-public-toggle-text">
        <strong>{checked ? "Публичный профиль" : "Закрытый профиль"}</strong>
        <small>
          {checked
            ? "Показывается в каталоге учёных после верификации, доступен для поиска и SEO."
            : "Скрыт из публичного каталога, поиска и SEO. Связанные материалы также скрываются."}
        </small>
      </div>
    </label>
  );
}
