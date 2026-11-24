import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BookOpen,
  Clock,
  Compass,
  Database,
  ExternalLink,
  GitFork,
  Info,
  Layers,
  Network,
  Send,
} from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import type { PublicOpenDataPayload } from "@/types/domain/open-data";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { OpenDataIcon } from "./OpenDataIcon";

type Props = {
  data: PublicOpenDataPayload;
  locale: Locale;
  siteName: string;
};

const copy = {
  ru: {
    badge: "Инициатива СМУ",
    updatedAt: "Актуально на",
    metricsTitle: "Текущее состояние платформы",
    metricsIntro: "Ключевые показатели формирования базы научных данных Актюбинской области.",
    emptyMetrics: "В настоящее время ведётся первичный сбор и систематизация научных данных.",
    categoriesTitle: "Направления сбора данных",
    categoriesIntro: "Тематические категории данных, формируемые для научных исследований региона.",
    datasetsCollected: "Собрано наборов:",
    updatesTitle: "Последние поступления",
    updatesIntro: "Недавно зарегистрированные и систематизированные наборы данных.",
    source: "Источник:",
    period: "Период охвата:",
    goalsTitle: "Долгосрочные цели инициативы",
    goalsIntro: "Формирование единой открытой научной инфраструктуры для региональных исследований.",
    goals: [
      {
        title: "Сохранение научных данных региона",
        desc: "Формирование надёжного долговременного цифрового архива результатов региональных исследований.",
      },
      {
        title: "Обеспечение исследователей материалами",
        desc: "Предоставление молодым учёным и научным коллективам качественных структурированных данных.",
      },
      {
        title: "Повторное использование результатов",
        desc: "Создание условий для верификации и нового использования уже полученных исследовательских данных.",
      },
      {
        title: "Систематизация разрозненных источников",
        desc: "Объединение статистических, экологических, архивных и экспедиционных сведений в едином пространстве.",
      },
      {
        title: "Развитие междисциплинарных исследований",
        desc: "Связывание экологических, демографических, экономических и GIS-слоев для комплексных проектов.",
      },
      {
        title: "Создание долговременной научной инфраструктуры",
        desc: "Развитие устойчивого фундамента открытой науки в Актюбинской области.",
      },
    ],
    collaborationTitle: "Приглашение к сотрудничеству",
    btnContribute: "Предложить данные",
    btnRequest: "Запросить данные",
    made: "Сделано для науки и региона",
    contacts: "Контакты",
    footerText: "Объединяем учёных, данные и технологии для решения задач и развития Актюбинской области.",
  },
  kk: {
    badge: "ЖҒК бастамасы",
    updatedAt: "Деректердің өзектілігі:",
    metricsTitle: "Платформаның ағымдағы жағдайы",
    metricsIntro: "Ақтөбе облысының ғылыми деректер қорын қалыптастырудың негізгі көрсеткіштері.",
    emptyMetrics: "Қазіргі уақытта ғылыми деректерді бастапқы жинау және жүйелеу жұмыстары жүргізілуде.",
    categoriesTitle: "Деректерді жинау бағыттары",
    categoriesIntro: "Өңірлік ғылыми зерттеулер үшін қалыптастырылатын тақырыптық деректер санаттары.",
    datasetsCollected: "Жиналған жиынтықтар:",
    updatesTitle: "Соңғы түсімдер",
    updatesIntro: "Жақында тіркелген және жүйеленген ғылыми деректер жиынтықтары.",
    source: "Дереккөз:",
    period: "Қамту кезеңі:",
    goalsTitle: "Бастаманың ұзақ мерзімді мақсаттары",
    goalsIntro: "Өңірлік зерттеулер үшін бірыңғай ашық ғылыми инфрақұрылымды қалыптастыру.",
    goals: [
      {
        title: "Өңірдің ғылыми деректерін сақтау",
        desc: "Өңірлік зерттеу нәтижелерінің сенімді әрі ұзақ мерзімді цифрлық мұрағатын қалыптастыру.",
      },
      {
        title: "Зерттеушілерді қажетті материалдармен қамтамасыз ету",
        desc: "Жас ғалымдар мен ғылыми топтарға сапалы әрі жүйеленген деректерді ұсыну.",
      },
      {
        title: "Зерттеу нәтижелерін қайта пайдалану",
        desc: "Бұрын алынған зерттеу деректерін тексеру және жаңа қырынан пайдалану үшін жағдай жасау.",
      },
      {
        title: "Шашыраңқы ақпарат көздерін жүйелеу",
        desc: "Статистикалық, экологиялық, мұрағаттық және экспедициялық мәліметтерді бірыңғай кеңістікке біріктіру.",
      },
      {
        title: "Пәнаралық зерттеулерді дамыту",
        desc: "Кешенді жобалар үшін экологиялық, демографиялық, экономикалық және GIS-деректерді байланыстыру.",
      },
      {
        title: "Өңірдің ұзақ мерзімді ғылыми инфрақұрылымын құру",
        desc: "Ақтөбе облысында ашық ғылымның тұрақты іргетасын дамыту.",
      },
    ],
    collaborationTitle: "Ынтымақтастыққа шақыру",
    btnContribute: "Деректер ұсыну",
    btnRequest: "Деректерге сұраныс жіберу",
    made: "Ғылым мен өңір үшін жасалды",
    contacts: "Байланыстар",
    footerText: "Ақтөбе облысының міндеттерін шешу және дамыту үшін ғалымдарды, деректер мен технологияларды біріктіреміз.",
  },
  en: {
    badge: "SMU Initiative",
    updatedAt: "Up to date as of",
    metricsTitle: "Current platform state",
    metricsIntro: "Key indicators for the formation of the Aktobe Region scientific database.",
    emptyMetrics: "Initial collection and systematization of regional research data is currently underway.",
    categoriesTitle: "Data collection directions",
    categoriesIntro: "Thematic categories of data collected for scientific research in the region.",
    datasetsCollected: "Datasets collected:",
    updatesTitle: "Latest additions",
    updatesIntro: "Recently registered and systematized research datasets.",
    source: "Source:",
    period: "Coverage period:",
    goalsTitle: "Long-term goals of initiative",
    goalsIntro: "Developing a unified open scientific infrastructure for regional research.",
    goals: [
      {
        title: "Preserving scientific data of the region",
        desc: "Creating a reliable long-term digital archive of regional research results.",
      },
      {
        title: "Providing researchers with necessary materials",
        desc: "Delivering high-quality structured data to young researchers and scientific teams.",
      },
      {
        title: "Reuse of research outputs",
        desc: "Enabling verification and new utilization of existing research data.",
      },
      {
        title: "Systematizing scattered sources of information",
        desc: "Consolidating statistical, ecological, archival, and field data into a unified space.",
      },
      {
        title: "Advancing interdisciplinary research",
        desc: "Connecting ecological, demographic, economic, and GIS layers for complex projects.",
      },
      {
        title: "Building sustainable scientific infrastructure",
        desc: "Developing a lasting foundation for open science in the Aktobe Region.",
      },
    ],
    collaborationTitle: "Invitation to collaborate",
    btnContribute: "Contribute data",
    btnRequest: "Request data",
    made: "Made for science and the region",
    contacts: "Contacts",
    footerText: "Connecting scientists, data, and technology to solve challenges and advance the Aktobe Region.",
  },
} as const;

const goalIcons = [Archive, BookOpen, GitFork, Layers, Network, Compass];

export function PublicOpenData({ data, locale, siteName }: Props) {
  const t = copy[locale] ?? copy.ru;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="opendata-page">
      <PublicHeader
        locale={locale}
        section="research"
        siteName={siteName}
        paths={{
          ru: "/ru/open-data",
          kk: "/kk/open-data",
          en: "/en/open-data",
        }}
      />

      {/* 5.1 Hero screen */}
      <section className="opendata-hero">
        <div className="opendata-hero-inner">
          <div className="opendata-hero-eyebrow">
            <span className="opendata-initiative-badge">
              <Database size={14} aria-hidden="true" />
              {t.badge}
            </span>
            <span className="opendata-status-badge">
              <span className="opendata-status-dot" aria-hidden="true" />
              {data.statusText}
            </span>
          </div>

          <h1 className="opendata-hero-title">{data.title}</h1>
          <p className="opendata-hero-subtitle">{data.subtitle}</p>
          <div className="opendata-hero-description">{data.description}</div>

          <div className="opendata-hero-meta">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={16} aria-hidden="true" />
              {t.updatedAt} <strong>{formatDate(data.dataUpdatedAt)}</strong>
            </span>
          </div>
        </div>
      </section>

      <main className="opendata-content">
        {/* 5.2 Metrics section */}
        <section aria-labelledby="metrics-title">
          <div className="opendata-section-header">
            <h2 id="metrics-title" className="opendata-section-title">
              {t.metricsTitle}
            </h2>
            <p className="opendata-section-intro">{t.metricsIntro}</p>
          </div>

          {data.hasFilledMetrics ? (
            <div className="opendata-metrics-grid">
              {data.metrics.map((m) => {
                const displayVal =
                  m.valueNumeric !== null
                    ? m.valueNumeric.toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU")
                    : m.valueText ?? "";

                return (
                  <div key={m.id} className="opendata-metric-card">
                    <div className="opendata-metric-icon">
                      <OpenDataIcon name={m.icon} size={22} />
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
              <Info size={20} style={{ color: "#0284c7", flexShrink: 0 }} aria-hidden="true" />
              <span>{t.emptyMetrics}</span>
            </div>
          )}
        </section>

        {/* 5.3 Categories section */}
        {data.categories.length > 0 ? (
          <section aria-labelledby="categories-title">
            <div className="opendata-section-header">
              <h2 id="categories-title" className="opendata-section-title">
                {t.categoriesTitle}
              </h2>
              <p className="opendata-section-intro">{t.categoriesIntro}</p>
            </div>

            <div className="opendata-categories-grid">
              {data.categories.map((c) => (
                <article key={c.id} className="opendata-category-card">
                  <div className="opendata-category-top">
                    <div className="opendata-category-icon">
                      <OpenDataIcon name={c.icon} size={24} />
                    </div>
                    <span className={`opendata-category-status opendata-status-${c.status}`}>
                      {c.statusLabel}
                    </span>
                  </div>

                  <div>
                    <h3 className="opendata-category-title">{c.title}</h3>
                    {c.description ? <p className="opendata-category-desc">{c.description}</p> : null}
                  </div>

                  <div className="opendata-category-footer">
                    <div className="opendata-category-stats-row">
                      <span>{t.datasetsCollected}</span>
                      <span className="opendata-category-stats-count">
                        {c.datasetCount !== null ? c.datasetCount : "—"}
                      </span>
                    </div>

                    {/* Relative horizontal indicator (not % readiness) */}
                    {c.relativeShare > 0 ? (
                      <div className="opendata-indicator-track" title={`Относительный объём: ${c.relativeShare}%`}>
                        <div
                          className="opendata-indicator-fill"
                          style={{ width: `${c.relativeShare}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* 5.4 Latest arrivals section */}
        {data.latestUpdates.length > 0 ? (
          <section aria-labelledby="updates-title">
            <div className="opendata-section-header">
              <h2 id="updates-title" className="opendata-section-title">
                {t.updatesTitle}
              </h2>
              <p className="opendata-section-intro">{t.updatesIntro}</p>
            </div>

            <div className="opendata-updates-list">
              {data.latestUpdates.map((u) => (
                <article key={u.id} className="opendata-update-card">
                  <div className="opendata-update-header">
                    <span className="opendata-update-category">
                      <OpenDataIcon name={u.categoryIcon} size={14} />
                      {u.categoryTitle}
                    </span>
                    <span className="opendata-update-date">{formatDate(u.receivedAt)}</span>
                  </div>

                  <h3 className="opendata-update-title">{u.title}</h3>
                  {u.description ? <p className="opendata-update-desc">{u.description}</p> : null}

                  <div className="opendata-update-meta">
                    <div>
                      <strong>{t.source}</strong>{" "}
                      {u.sourceUrl ? (
                        <a
                          href={u.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#0284c7", textDecoration: "underline" }}
                        >
                          {u.sourceName} <ExternalLink size={12} style={{ display: "inline" }} />
                        </a>
                      ) : (
                        <span>{u.sourceName}</span>
                      )}
                    </div>
                    {u.periodStart || u.periodEnd ? (
                      <div>
                        <strong>{t.period}</strong> {u.periodStart ?? "..."} — {u.periodEnd ?? "..."}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* 5.5 Long-term goals */}
        <section aria-labelledby="goals-title">
          <div className="opendata-section-header">
            <h2 id="goals-title" className="opendata-section-title">
              {t.goalsTitle}
            </h2>
            <p className="opendata-section-intro">{t.goalsIntro}</p>
          </div>

          <div className="opendata-goals-grid">
            {t.goals.map((g, idx) => {
              const Icon = goalIcons[idx % goalIcons.length];
              return (
                <div key={g.title} className="opendata-goal-card">
                  <div className="opendata-goal-icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <strong>{g.title}</strong>
                    <p>{g.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5.6 Invitation to collaborate */}
        <section className="opendata-collab-box" aria-labelledby="collab-title">
          <h2 id="collab-title">{t.collaborationTitle}</h2>
          <p>{data.collaborationText}</p>
          <div className="opendata-collab-actions">
            <Link
              href={`/${locale}/pages/contacts?subject=open_data_contribution`}
              className="opendata-btn-contribute"
            >
              <span>{t.btnContribute}</span>
              <Send size={16} aria-hidden="true" />
            </Link>
            <Link
              href={`/${locale}/pages/contacts?subject=open_data_request`}
              className="opendata-btn-request"
            >
              <span>{t.btnRequest}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
