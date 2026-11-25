"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Globe,
  ImageIcon,
  Info,
  Link2,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { generateSlug } from "@/lib/articles/slug";
import {
  eventFormatLabels,
  eventKindLabels,
  eventLocalInput,
  eventStatusLabels,
} from "@/lib/events";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { isMediaFileAllowed } from "@/lib/media/rules";
import {
  eventFormats,
  eventKinds,
  type EventFormat,
  type EventKind,
  type ScienceEvent,
} from "@/types/domain/event";
import type { MediaAsset } from "@/types/domain/media";

type Props = {
  action: (form: FormData) => Promise<void>;
  event?: ScienceEvent;
  media: MediaAsset[];
  submitLabel?: string;
};

export function EventForm({
  action,
  event,
  media,
  submitLabel = event ? "Сохранить событие" : "Создать событие",
}: Props) {
  const [activeLocale, setActiveLocale] = useState<"ru" | "kk" | "en">("ru");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const ru = event?.translations.find((item) => item.locale === "ru");
  const kk = event?.translations.find((item) => item.locale === "kk");
  const en = event?.translations.find((item) => item.locale === "en");

  // Translation states
  const [titles, setTitles] = useState({
    ru: ru?.title ?? "",
    kk: kk?.title ?? "",
    en: en?.title ?? "",
  });

  const [slugs, setSlugs] = useState({
    ru: ru?.slug ?? "",
    kk: kk?.slug ?? "",
    en: en?.slug ?? "",
  });

  const [isSlugTouched, setIsSlugTouched] = useState({
    ru: Boolean(ru?.slug),
    kk: Boolean(kk?.slug),
    en: Boolean(en?.slug),
  });

  const [organizers, setOrganizers] = useState({
    ru: ru?.organizer ?? "",
    kk: kk?.organizer ?? "",
    en: en?.organizer ?? "",
  });

  const [locations, setLocations] = useState({
    ru: ru?.location ?? "",
    kk: kk?.location ?? "",
    en: en?.location ?? "",
  });

  const [summaries, setSummaries] = useState({
    ru: ru?.summary ?? "",
    kk: kk?.summary ?? "",
    en: en?.summary ?? "",
  });

  const [descriptions, setDescriptions] = useState({
    ru: ru?.description ?? "",
    kk: kk?.description ?? "",
    en: en?.description ?? "",
  });

  // Settings
  const [kind, setKind] = useState<EventKind>(event?.kind ?? "conference");
  const [format, setFormat] = useState<EventFormat>(event?.format ?? "offline");

  // Cover Media states
  const [coverMediaId, setCoverMediaId] = useState(event?.coverMediaId ?? "");
  const [mediaList, setMediaList] = useState<MediaAsset[]>(media);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewUploadUrl, setPreviewUploadUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMediaList(media);
  }, [media]);

  const selectedCover = mediaList.find((item) => item.id === coverMediaId);
  const coverDisplayUrl =
    previewUploadUrl ||
    selectedCover?.previewUrl ||
    (coverMediaId && coverMediaId === event?.coverMediaId ? event?.coverUrl : null);

  const filteredMedia = mediaList.filter(
    (asset) =>
      asset.status === "ready" &&
      !asset.deletedAt &&
      asset.mimeType?.startsWith("image/") &&
      (!mediaSearchQuery.trim() ||
        asset.fileName.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
        (asset.altRu && asset.altRu.toLowerCase().includes(mediaSearchQuery.toLowerCase())))
  );

  const handleSelectCover = (assetId: string) => {
    setCoverMediaId(assetId);
    setPreviewUploadUrl(null);
    setUploadError("");
    setIsMediaModalOpen(false);
  };

  const handleRemoveCover = () => {
    setCoverMediaId("");
    setPreviewUploadUrl(null);
    setUploadError("");
  };

  const handleDirectUpload = async (file: File) => {
    if (!isMediaFileAllowed("event-media", file.name, file.type, file.size)) {
      setUploadError("Недопустимый формат файла или размер превышает лимит (до 50 МБ).");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const ticketResponse = await fetch("/api/admin/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          bucket: "event-media",
        }),
      });

      if (!ticketResponse.ok) {
        const errData = await ticketResponse.json().catch(() => ({}));
        throw new Error(errData?.error ?? "ticket_failed");
      }

      const ticket = await ticketResponse.json();
      const client = createBrowserSupabaseClient();
      const { error: uploadError } = await client.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const completeResponse = await fetch("/api/admin/media/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaAssetId: ticket.mediaAssetId,
        }),
      });

      if (!completeResponse.ok) throw new Error("complete_failed");

      const localUrl = URL.createObjectURL(file);
      setPreviewUploadUrl(localUrl);
      setCoverMediaId(ticket.mediaAssetId);

      const newAsset: MediaAsset = {
        id: ticket.mediaAssetId,
        storageBucket: "event-media",
        storagePath: ticket.path,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        status: "ready",
        previewUrl: localUrl,
        width: null,
        height: null,
        altRu: null,
        altKk: null,
        altEn: null,
        captionRu: null,
        captionKk: null,
        captionEn: null,
        copyrightHolder: null,
        sourceUrl: null,
        uploadedBy: "",
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };

      setMediaList((prev) => [newAsset, ...prev]);
      setIsMediaModalOpen(false);
    } catch {
      setUploadError("Не удалось загрузить изображение. Попробуйте выбрать файл из медиатеки.");
    } finally {
      setIsUploading(false);
    }
  };

  const [startsAt, setStartsAt] = useState(eventLocalInput(event?.startsAt));
  const [endsAt, setEndsAt] = useState(eventLocalInput(event?.endsAt));
  const [registrationDeadline, setRegistrationDeadline] = useState(
    eventLocalInput(event?.registrationDeadline)
  );
  const [registrationUrl, setRegistrationUrl] = useState(event?.registrationUrl ?? "");
  const [externalUrl, setExternalUrl] = useState(event?.externalUrl ?? "");

  const handleTitleChange = (locale: "ru" | "kk" | "en", val: string) => {
    setTitles((prev) => ({ ...prev, [locale]: val }));
    if (!isSlugTouched[locale] && val.trim()) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(val) }));
    }
  };

  const handleSlugChange = (locale: "ru" | "kk" | "en", val: string) => {
    setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
    setSlugs((prev) => ({ ...prev, [locale]: val }));
  };

  const handleRegenerateSlug = (locale: "ru" | "kk" | "en") => {
    const title = titles[locale];
    if (title.trim()) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(title) }));
      setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
    }
  };

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const validateForm = (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMsg("");

    // Date & time validation
    if (!startsAt || !endsAt) {
      e.preventDefault();
      setErrorMsg("Укажите дату и время начала и окончания события.");
      return;
    }

    if (endsAt <= startsAt) {
      e.preventDefault();
      setErrorMsg("Время окончания должно быть строго позже времени начала события.");
      return;
    }

    if (registrationDeadline) {
      if (registrationDeadline > startsAt) {
        e.preventDefault();
        setErrorMsg("Дедлайн регистрации должен быть не позже времени начала события.");
        return;
      }
      if (!registrationUrl.trim()) {
        e.preventDefault();
        setErrorMsg("При указании дедлайна регистрации необходимо ввести ссылку на форму регистрации.");
        return;
      }
    }

    if (format !== "offline" && !externalUrl.trim()) {
      e.preventDefault();
      setErrorMsg("Для онлайн и гибридного формата обязательна ссылка на публичный сайт или трансляцию.");
      return;
    }

    if (format !== "online") {
      if (!locations.ru.trim() || locations.ru.trim().length < 3) {
        e.preventDefault();
        setErrorMsg("Укажите место проведения (город, адрес) на русском языке (минимум 3 символа).");
        setActiveLocale("ru");
        return;
      }
      if (!locations.kk.trim() || locations.kk.trim().length < 3) {
        e.preventDefault();
        setErrorMsg("Укажите место проведения (город, адрес) на казахском языке (минимум 3 символа).");
        setActiveLocale("kk");
        return;
      }
    }

    // Russian validation (mandatory)
    if (!titles.ru.trim() || titles.ru.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название события на русском языке (минимум 3 символа).");
      setActiveLocale("ru");
      return;
    }
    if (!slugs.ru.trim() || !slugRegex.test(slugs.ru.trim()) || slugs.ru.trim().length < 2) {
      e.preventDefault();
      setErrorMsg("URL slug (RU) должен содержать строчные латинские буквы, цифры и дефисы (от 2 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!organizers.ru.trim() || organizers.ru.trim().length < 2) {
      e.preventDefault();
      setErrorMsg("Укажите организатора события на русском языке (минимум 2 символа).");
      setActiveLocale("ru");
      return;
    }
    if (!summaries.ru.trim() || summaries.ru.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите краткое описание события на русском языке (минимум 20 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!descriptions.ru.trim() || descriptions.ru.trim().length < 40) {
      e.preventDefault();
      setErrorMsg("Укажите подробное описание и программу события на русском языке (минимум 40 символов).");
      setActiveLocale("ru");
      return;
    }

    // Kazakh validation (mandatory)
    if (!titles.kk.trim() || titles.kk.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название события на казахском языке (минимум 3 символа).");
      setActiveLocale("kk");
      return;
    }
    if (!slugs.kk.trim() || !slugRegex.test(slugs.kk.trim()) || slugs.kk.trim().length < 2) {
      e.preventDefault();
      setErrorMsg("URL slug (KK) должен содержать строчные латинские буквы, цифры и дефисы (от 2 символов).");
      setActiveLocale("kk");
      return;
    }
    if (!organizers.kk.trim() || organizers.kk.trim().length < 2) {
      e.preventDefault();
      setErrorMsg("Укажите организатора события на казахском языке (минимум 2 символа).");
      setActiveLocale("kk");
      return;
    }
    if (!summaries.kk.trim() || summaries.kk.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите краткое описание события на казахском языке (минимум 20 символов).");
      setActiveLocale("kk");
      return;
    }
    if (!descriptions.kk.trim() || descriptions.kk.trim().length < 40) {
      e.preventDefault();
      setErrorMsg("Укажите подробное описание и программу события на казахском языке (минимум 40 символов).");
      setActiveLocale("kk");
      return;
    }

    // English validation (optional, but if filled must satisfy rules)
    const hasEn =
      titles.en.trim() ||
      slugs.en.trim() ||
      organizers.en.trim() ||
      locations.en.trim() ||
      summaries.en.trim() ||
      descriptions.en.trim();

    if (hasEn) {
      if (!titles.en.trim() || titles.en.trim().length < 3) {
        e.preventDefault();
        setErrorMsg("Для английской версии название должно содержать от 3 символов.");
        setActiveLocale("en");
        return;
      }
      if (!slugs.en.trim() || !slugRegex.test(slugs.en.trim()) || slugs.en.trim().length < 2) {
        e.preventDefault();
        setErrorMsg("URL slug (EN) должен содержать строчные латинские буквы, цифры и дефисы (от 2 символов).");
        setActiveLocale("en");
        return;
      }
      if (!organizers.en.trim() || organizers.en.trim().length < 2) {
        e.preventDefault();
        setErrorMsg("Для английской версии укажите организатора (от 2 символов).");
        setActiveLocale("en");
        return;
      }
      if (!summaries.en.trim() || summaries.en.trim().length < 20) {
        e.preventDefault();
        setErrorMsg("Для английской версии краткое описание должно содержать от 20 символов.");
        setActiveLocale("en");
        return;
      }
      if (!descriptions.en.trim() || descriptions.en.trim().length < 40) {
        e.preventDefault();
        setErrorMsg("Для английской версии описание должно содержать от 40 символов.");
        setActiveLocale("en");
        return;
      }
    }
  };

  const isRuComplete =
    titles.ru.trim() &&
    organizers.ru.trim() &&
    summaries.ru.trim() &&
    descriptions.ru.trim() &&
    (format === "online" || locations.ru.trim().length >= 3);

  const isKkComplete =
    titles.kk.trim() &&
    organizers.kk.trim() &&
    summaries.kk.trim() &&
    descriptions.kk.trim() &&
    (format === "online" || locations.kk.trim().length >= 3);

  const isEnComplete =
    titles.en.trim() &&
    organizers.en.trim() &&
    summaries.en.trim() &&
    descriptions.en.trim();

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setErrorMsg("");
        try {
          await action(formData);
        } catch (e: any) {
          if (e?.message?.includes("NEXT_REDIRECT") || e?.message?.includes("redirect:")) {
            throw e;
          }
          setErrorMsg("Произошла ошибка при сохранении события.");
          setPending(false);
        }
      }}
      onSubmit={validateForm}
      className="article-form wp-editor-form"
    >
      {errorMsg ? (
        <div role="alert" className="notice error-notice" style={{ marginBottom: "16px" }}>
          {errorMsg}
        </div>
      ) : null}

      {/* TOPBAR: Language Tabs & Submit Button */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии события">
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "ru"}
              className={`wp-lang-tab ${activeLocale === "ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("ru")}
            >
              <span className={`wp-tab-dot ${isRuComplete ? "is-filled" : ""}`} />
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
              <span className={`wp-tab-dot ${isKkComplete ? "is-filled" : ""}`} />
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
              <span className={`wp-tab-dot ${isEnComplete ? "is-filled" : ""}`} />
              English <small className="wp-tab-optional">необяз.</small>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          {event ? (
            <span
              className={`status-badge status-${event.status}`}
              style={{ fontSize: "12px", padding: "4px 10px" }}
            >
              {eventStatusLabels[event.status]}
            </span>
          ) : null}
          <button
            type="submit"
            disabled={pending}
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
          {(["ru", "kk", "en"] as const).map((locale) => {
            const suffix = locale === "ru" ? "Ru" : locale === "kk" ? "Kk" : "En";
            const isMandatory = locale !== "en";

            return (
              <div
                key={locale}
                style={{ display: activeLocale === locale ? "block" : "none" }}
              >
                <div className="wp-editor-content-box">
                  {/* TITLE */}
                  <div className="wp-title-section">
                    <label className="wp-field-label" htmlFor={`event-title-${locale}`}>
                      Название события ({locale.toUpperCase()}){" "}
                      {isMandatory ? (
                        <span style={{ color: "#e11d48" }}>*</span>
                      ) : (
                        <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                      )}
                    </label>
                    <input
                      id={`event-title-${locale}`}
                      name={`title${suffix}`}
                      value={titles[locale]}
                      maxLength={240}
                      className="wp-title-input"
                      disabled={pending}
                      placeholder={
                        locale === "ru"
                          ? "Например: Международная научно-практическая конференция молодых учёных..."
                          : locale === "kk"
                          ? "Мысалы: Жас ғалымдардың халықаралық ғылыми-тәжірибелік конференциясы..."
                          : "E.g., International Scientific and Practical Conference of Young Scientists..."
                      }
                      onChange={(e) => handleTitleChange(locale, e.target.value)}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "6px",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      <span>
                        {isMandatory
                          ? "Минимум 3 символа, максимум 240"
                          : "Для публикации на английском языке"}
                      </span>
                      <span>{titles[locale].length}/240</span>
                    </div>
                  </div>

                  {/* SLUG */}
                  <div className="wp-slug-section" style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label className="wp-field-label" htmlFor={`event-slug-${locale}`}>
                        URL slug ({locale.toUpperCase()}){" "}
                        {isMandatory ? (
                          <span style={{ color: "#e11d48" }}>*</span>
                        ) : (
                          <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRegenerateSlug(locale)}
                        className="button-link"
                        style={{
                          fontSize: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--forest-bright)",
                        }}
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        <span>Сгенерировать из названия</span>
                      </button>
                    </div>
                    <div style={{ position: "relative", marginTop: "4px" }}>
                      <input
                        id={`event-slug-${locale}`}
                        name={`slug${suffix}`}
                        value={slugs[locale]}
                        maxLength={160}
                        disabled={pending}
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        placeholder={
                          locale === "ru"
                            ? "young-scientists-conference"
                            : locale === "kk"
                            ? "zhas-galymdar-konferentsiyasy"
                            : "young-scientists-conference-en"
                        }
                        onChange={(e) => handleSlugChange(locale, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          fontFamily: "monospace",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                    <p style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      Латинские буквы, цифры и дефисы. Уникальный адрес страницы события.
                    </p>
                  </div>

                  {/* ORGANIZER & LOCATION ROW */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "16px",
                      marginTop: "18px",
                    }}
                  >
                    {/* ORGANIZER */}
                    <div>
                      <label
                        className="wp-field-label"
                        htmlFor={`event-org-${locale}`}
                        style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}
                      >
                        <Users size={14} aria-hidden="true" />
                        <span>
                          Организатор ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необяз.</small>
                          )}
                        </span>
                      </label>
                      <input
                        id={`event-org-${locale}`}
                        name={`organizer${suffix}`}
                        value={organizers[locale]}
                        maxLength={240}
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Совет молодых учёных Актюбинской области"
                            : locale === "kk"
                            ? "Ақтөбе облысының Жас ғалымдар кеңесі"
                            : "Council of Young Scientists of Aktobe region"
                        }
                        onChange={(e) =>
                          setOrganizers((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                        style={{ width: "100%", padding: "8px 12px", fontSize: "14px" }}
                      />
                    </div>

                    {/* LOCATION */}
                    <div>
                      <label
                        className="wp-field-label"
                        htmlFor={`event-loc-${locale}`}
                        style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}
                      >
                        <MapPin size={14} aria-hidden="true" />
                        <span>
                          Место проведения ({locale.toUpperCase()}){" "}
                          {format !== "online" && isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>
                              {format === "online" ? "не требуется для онлайн" : "необяз."}
                            </small>
                          )}
                        </span>
                      </label>
                      <input
                        id={`event-loc-${locale}`}
                        name={`location${suffix}`}
                        value={locations[locale]}
                        maxLength={500}
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "г. Актобе, ул. Абулхаир-хана 56, Конференц-зал"
                            : locale === "kk"
                            ? "Ақтөбе қ., Әбілқайыр хан даңғылы 56, Конференц-зал"
                            : "Aktobe, Abulkhair-khan Ave 56, Conference Hall"
                        }
                        onChange={(e) =>
                          setLocations((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                        style={{ width: "100%", padding: "8px 12px", fontSize: "14px" }}
                      />
                    </div>
                  </div>

                  {/* SUMMARY */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`event-summary-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          Краткое описание ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                          )}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {summaries[locale].length} / 800
                        </span>
                      </div>
                      <textarea
                        id={`event-summary-${locale}`}
                        name={`summary${suffix}`}
                        rows={3}
                        maxLength={800}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Краткий анонс события для карточки каталога (от 20 до 800 символов)..."
                            : locale === "kk"
                            ? "Каталог карточкасына арналған іс-шараның қысқаша аңдатпасы (20-дан 800 таңбаға дейін)..."
                            : "Brief event announcement for catalog cards (20 to 800 characters)..."
                        }
                        value={summaries[locale]}
                        onChange={(e) =>
                          setSummaries((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="wp-field-hint" style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      {isMandatory ? "Минимум 20 символов." : "Минимум 20 символов, если поле заполнено."}
                    </p>
                  </div>

                  {/* DESCRIPTION & PROGRAM */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`event-desc-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          Описание и программа события ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                          )}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {descriptions[locale].length} / 30000
                        </span>
                      </div>
                      <textarea
                        id={`event-desc-${locale}`}
                        name={`description${suffix}`}
                        rows={10}
                        maxLength={30000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Подробное расписание секций, ключевые спикеры, регламент докладов и условия публикации материалов..."
                            : locale === "kk"
                            ? "Секциялардың толық кестесі, негізгі спикерлер, баяндама регламенті және материалдарды жариялау шарттары..."
                            : "Detailed schedule of sessions, keynote speakers, presentation guidelines, and submission rules..."
                        }
                        value={descriptions[locale]}
                        onChange={(e) =>
                          setDescriptions((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="wp-field-hint" style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      {isMandatory ? "Минимум 40 символов." : "Минимум 40 символов, если поле заполнено."}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SIDEBAR COLUMN */}
        <aside className="wp-editor-sidebar">
          {/* EVENT PARAMETERS */}
          <section className="article-editor-panel wp-editor-content-box">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Calendar size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 650 }}>Параметры события</h2>
            </div>

            {/* KIND */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="event-kind" className="wp-field-label" style={{ marginBottom: "6px" }}>
                Тип события <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <select
                id="event-kind"
                name="kind"
                value={kind}
                disabled={pending}
                onChange={(e) => setKind(e.target.value as EventKind)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              >
                {eventKinds.map((k) => (
                  <option key={k} value={k}>
                    {eventKindLabels.ru[k]}
                  </option>
                ))}
              </select>
            </div>

            {/* FORMAT */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="event-format"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <Globe size={14} aria-hidden="true" />
                <span>Формат проведения <span style={{ color: "#e11d48" }}>*</span></span>
              </label>
              <select
                id="event-format"
                name="format"
                value={format}
                disabled={pending}
                onChange={(e) => setFormat(e.target.value as EventFormat)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              >
                {eventFormats.map((f) => (
                  <option key={f} value={f}>
                    {eventFormatLabels.ru[f]}
                  </option>
                ))}
              </select>
            </div>

            {/* COVER MEDIA (WITH THUMBNAIL & INSTANT INSERT) */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label
                  htmlFor="event-coverMediaId"
                  className="wp-field-label"
                  style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0 }}
                >
                  <ImageIcon size={14} aria-hidden="true" />
                  <span>Обложка события</span>
                </label>
                {coverDisplayUrl ? (
                  <span style={{ fontSize: "11px", color: "var(--forest-bright)", fontWeight: 600 }}>
                    Установлена
                  </span>
                ) : null}
              </div>

              {/* Synchronized hidden select for exact FormData submission */}
              <select
                id="event-coverMediaId"
                name="coverMediaId"
                value={coverMediaId}
                onChange={(e) => setCoverMediaId(e.target.value)}
                style={{ display: "none" }}
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="">Без обложки</option>
                {mediaList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fileName}
                  </option>
                ))}
                {coverMediaId && !mediaList.some((item) => item.id === coverMediaId) ? (
                  <option value={coverMediaId}>Текущая обложка</option>
                ) : null}
              </select>

              {/* Hidden file inputs for direct upload from PC */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleDirectUpload(file);
                  e.target.value = "";
                }}
              />
              <input
                ref={modalFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleDirectUpload(file);
                  e.target.value = "";
                }}
              />

              {uploadError ? (
                <div
                  className="notice error-notice"
                  style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "8px" }}
                >
                  {uploadError}
                </div>
              ) : null}

              {coverDisplayUrl ? (
                <div className="wp-cover-preview-card">
                  <div className="wp-cover-thumbnail-box">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverDisplayUrl}
                      alt={selectedCover?.altRu ?? selectedCover?.fileName ?? "Обложка события"}
                      className="wp-cover-image"
                    />
                  </div>
                  <div className="wp-cover-info">
                    <p className="wp-cover-filename" title={selectedCover?.fileName ?? "Обложка"}>
                      {selectedCover?.fileName ?? "Текущая обложка"}
                    </p>
                    {selectedCover?.width && selectedCover?.height ? (
                      <small className="wp-cover-dimensions">
                        {selectedCover.width} × {selectedCover.height} px
                      </small>
                    ) : null}
                  </div>
                  <div className="wp-cover-actions">
                    <button
                      type="button"
                      className="secondary-button wp-cover-btn"
                      onClick={() => setIsMediaModalOpen(true)}
                      disabled={pending || isUploading}
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <ImageIcon size={13} aria-hidden="true" />
                      <span>Заменить</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button wp-cover-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={pending || isUploading}
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      {isUploading ? (
                        <LoaderCircle className="spin" size={13} aria-hidden="true" />
                      ) : (
                        <UploadCloud size={13} aria-hidden="true" />
                      )}
                      <span>{isUploading ? "Загрузка…" : "Загрузить"}</span>
                    </button>
                    <button
                      type="button"
                      className="danger-button wp-cover-btn wp-cover-remove"
                      onClick={handleRemoveCover}
                      disabled={pending || isUploading}
                      title="Удалить обложку"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Удалить</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="wp-cover-empty-dropzone"
                  style={{ padding: "16px 12px" }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith("image/")) {
                      void handleDirectUpload(file);
                    }
                  }}
                >
                  <ImageIcon className="wp-cover-icon" aria-hidden="true" />
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>Обложка не выбрана</span>
                  <small style={{ color: "#64748b", fontSize: "11px", textAlign: "center" }}>
                    Рекомендуемый формат: 16:9 (1200 × 630 px)
                  </small>
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px", width: "100%" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setIsMediaModalOpen(true)}
                      disabled={pending || isUploading}
                      style={{
                        flex: 1,
                        fontSize: "12px",
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      <ImageIcon size={13} aria-hidden="true" />
                      <span>Медиатека</span>
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={pending || isUploading}
                      style={{
                        flex: 1,
                        fontSize: "12px",
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      {isUploading ? (
                        <LoaderCircle className="spin" size={13} aria-hidden="true" />
                      ) : (
                        <UploadCloud size={13} aria-hidden="true" />
                      )}
                      <span>{isUploading ? "Загрузка…" : "Загрузить"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* DATES & TIME */}
          <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Clock size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 650 }}>Дата и время</h2>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
              Время по Актобе (UTC+05:00).
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="event-startsAt" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Начало события <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="event-startsAt"
                name="startsAt"
                type="datetime-local"
                value={startsAt}
                disabled={pending}
                onChange={(e) => setStartsAt(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="event-endsAt" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Окончание события <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="event-endsAt"
                name="endsAt"
                type="datetime-local"
                value={endsAt}
                disabled={pending}
                onChange={(e) => setEndsAt(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
            </div>

            <div>
              <label htmlFor="event-regDeadline" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Дедлайн регистрации
              </label>
              <input
                id="event-regDeadline"
                name="registrationDeadline"
                type="datetime-local"
                value={registrationDeadline}
                disabled={pending}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Не позже начала события.
              </p>
            </div>
          </section>

          {/* REGISTRATION & LINKS */}
          <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Link2 size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 650 }}>Ссылки и регистрация</h2>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label htmlFor="event-regUrl" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Ссылка на регистрацию
              </label>
              <input
                id="event-regUrl"
                name="registrationUrl"
                type="url"
                value={registrationUrl}
                maxLength={1000}
                disabled={pending}
                placeholder="https://..."
                onChange={(e) => setRegistrationUrl(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Кнопка на странице доступна до дедлайна или начала.
              </p>
            </div>

            <div>
              <label htmlFor="event-extUrl" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Сайт события / трансляция{" "}
                {format !== "offline" ? (
                  <span style={{ color: "#e11d48" }}>*</span>
                ) : (
                  <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                )}
              </label>
              <input
                id="event-extUrl"
                name="externalUrl"
                type="url"
                value={externalUrl}
                maxLength={1000}
                disabled={pending}
                placeholder="https://..."
                onChange={(e) => setExternalUrl(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Обязательно для онлайн и гибридного формата.
              </p>
            </div>
          </section>

          {/* STATUS & PREVIEW */}
          {event ? (
            <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Info size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>Статус события</h3>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#475569" }}>
                Текущий статус:{" "}
                <span className={`status-badge status-${event.status}`} style={{ fontSize: "12px" }}>
                  {eventStatusLabels[event.status]}
                </span>
              </p>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                Отмена сохраняет страницу с отметкой об отмене и закрывает регистрацию. Правки возвращают
                событие в черновики.
              </p>
              {event.status === "published" || event.status === "cancelled" ? (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "10px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#334155", margin: "0 0 6px" }}>
                    Просмотр на сайте:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {event.translations.map((t) => (
                      <Link
                        key={t.locale}
                        href={`/${t.locale}/events/${t.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--forest-bright)",
                        }}
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                        <span>Открыть {t.locale.toUpperCase()}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      {/* MEDIA SELECTOR MODAL */}
      {isMediaModalOpen ? (
        <div
          className="wp-modal-backdrop"
          onClick={() => setIsMediaModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Выбор обложки из медиатеки"
        >
          <div className="wp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-header">
              <h3>Выбор обложки события</h3>
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
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={mediaSearchQuery}
                  onChange={(e) => setMediaSearchQuery(e.target.value)}
                  placeholder="Поиск по названию файла или описанию…"
                  className="wp-modal-search-input"
                  style={{ paddingLeft: "32px", width: "100%" }}
                />
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => modalFileInputRef.current?.click()}
                disabled={isUploading}
                style={{
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                {isUploading ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <UploadCloud size={14} />
                )}
                <span>{isUploading ? "Загрузка…" : "Загрузить фото"}</span>
              </button>
              <Link
                href="/admin/content/media"
                target="_blank"
                className="secondary-button wp-modal-upload-link"
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <span>Медиатека</span>
                <ExternalLink size={12} aria-hidden="true" />
              </Link>
            </div>

            {uploadError ? (
              <div className="notice error-notice" style={{ margin: "12px 20px 0" }}>
                {uploadError}
              </div>
            ) : null}

            <div className="wp-modal-grid">
              {filteredMedia.length > 0 ? (
                filteredMedia.map((asset) => (
                  <div
                    key={asset.id}
                    className={`wp-modal-item ${asset.id === coverMediaId ? "is-selected" : ""}`}
                    onClick={() => handleSelectCover(asset.id)}
                  >
                    <div className="wp-modal-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.previewUrl ?? ""}
                        alt={asset.altRu ?? asset.fileName}
                        loading="lazy"
                      />
                    </div>
                    <span className="wp-modal-filename" title={asset.fileName}>
                      {asset.fileName}
                    </span>
                    {asset.width && asset.height ? (
                      <small style={{ fontSize: "10px", color: "#94a3b8" }}>
                        {asset.width} × {asset.height}
                      </small>
                    ) : null}
                    {asset.id === coverMediaId ? (
                      <span
                        className="wp-modal-tag"
                        style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}
                      >
                        <Check size={11} aria-hidden="true" /> Выбрано
                      </span>
                    ) : null}
                  </div>
                ))
              ) : (
                <div
                  className="wp-modal-empty"
                  style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "#64748b",
                  }}
                >
                  {mediaList.length === 0
                    ? "В медиатеке пока нет готовых изображений. Вы можете загрузить новое фото выше."
                    : "Изображения по запросу не найдены."}
                </div>
              )}
            </div>

            <div
              className="wp-modal-footer"
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "12px", color: "#64748b", alignSelf: "center" }}>
                Нажмите на изображение для немедленной вставки
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsMediaModalOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
