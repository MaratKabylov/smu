import Link from "next/link";
import { ArrowRight, Database, Info } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import type { HomepageOpenDataPayload } from "@/types/domain/open-data";
import { OpenDataIcon } from "./OpenDataIcon";

type Props = {
  data: HomepageOpenDataPayload | null;
  locale: Locale;
};

const copy = {
  ru: {
    badge: "Инициатива СМУ",
    categoriesTitle: "Направления сбора данных",
    detailsBtn: "Подробнее о платформе",
    emptyNotice: "В настоящее время ведётся первичный сбор и систематизация научных данных.",
  },
  kk: {
    badge: "ЖҒК бастамасы",
    categoriesTitle: "Деректерді жинау бағыттары",
    detailsBtn: "Платформа туралы толығырақ",
    emptyNotice: "Қазіргі уақытта ғылыми деректерді бастапқы жинау және жүйелеу жұмыстары жүргізілуде.",
  },
  en: {
    badge: "SMU Initiative",
    categoriesTitle: "Data collection directions",
    detailsBtn: "More about platform",
    emptyNotice: "Initial collection and systematization of regional research data is currently underway.",
  },
} as const;

export function OpenDataHomepageBlock({ data, locale }: Props) {
  if (!data || !data.isPublished || !data.showOnHomepage) {
    return null;
  }

  const t = copy[locale] ?? copy.ru;

  return (
    <section className="opendata-home-block" aria-labelledby="opendata-title">
      <div className="opendata-home-header">
        <div className="opendata-badge-row">
          <span className="opendata-initiative-badge">
            <Database size={14} aria-hidden="true" />
            {t.badge}
          </span>
          <span className="opendata-status-badge">
            <span className="opendata-status-dot" aria-hidden="true" />
            {data.statusText}
          </span>
        </div>
        <h2 id="opendata-title" className="opendata-home-title">
          {data.title}
        </h2>
        <p className="opendata-home-subtitle">{data.subtitle}</p>
      </div>

      <p className="opendata-home-description">{data.shortDescription}</p>

      {/* Counters / Metrics */}
      {data.hasFilledMetrics ? (
        <div className="opendata-metrics-grid">
          {data.metrics.slice(0, 4).map((m) => {
            const displayVal =
              m.valueNumeric !== null
                ? m.valueNumeric.toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU")
                : m.valueText ?? "";

            return (
              <div key={m.id} className="opendata-metric-card">
                <div className="opendata-metric-icon">
                  <OpenDataIcon name={m.icon} size={20} />
                </div>
                <div className="opendata-metric-value">
                  <span>{displayVal}</span>
                  {m.unit ? <span className="opendata-metric-unit">{m.unit}</span> : null}
                </div>
                <div className="opendata-metric-title">{m.title}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="opendata-fallback-notice">
          <Info size={18} style={{ color: "#0284c7", flexShrink: 0 }} aria-hidden="true" />
          <span>{t.emptyNotice}</span>
        </div>
      )}

      {/* Categories */}
      {data.categories.length > 0 ? (
        <div className="opendata-categories-section">
          <div className="opendata-categories-label">{t.categoriesTitle}</div>
          <div className="opendata-home-categories-grid">
            {data.categories.slice(0, 6).map((c) => (
              <div key={c.id} className="opendata-home-category-pill">
                <OpenDataIcon name={c.icon} size={18} className="opendata-home-category-icon" />
                <span>{c.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* CTA Button */}
      <div className="opendata-home-actions">
        <Link href={`/${locale}/open-data`} className="opendata-cta-button">
          <span>{t.detailsBtn}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
