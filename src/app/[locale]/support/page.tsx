import Link from "next/link";
import { ArrowUpRight, BookOpen, Cpu, FlaskConical, User } from "lucide-react";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { supportCopy } from "@/lib/i18n/support-request";
import { locales, type Locale } from "@/lib/i18n/locales";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { supportKinds, type SupportKind } from "@/lib/validation/support-request";

const kindDescriptions: Record<Locale, Record<SupportKind, string>> = {
  ru: {
    research_proposal:
      "Предложите тему или инициативу исследования в Актюбинской области, требующую научного или практического содействия.",
    it_request:
      "Запросите цифровую разработку, автоматизацию научного процесса, создание базы данных или IT-инструмента.",
    publication_support:
      "Получите помощь в подготовке рукописи к публикации, подборе рецензируемого журнала или софинансировании статьи.",
  },
  kk: {
    research_proposal:
      "Ақтөбе облысында ғылыми немесе тәжірибелік қолдауды қажет ететін зерттеу тақырыбын немесе бастамасын ұсыныңыз.",
    it_request:
      "Цифрлық әзірлеуді, ғылыми үдерісті автоматтандыруды, дерекқорды немесе IT-құралды жасауды сұраңыз.",
    publication_support:
      "Қолжазбаны жариялауға дайындауға, рецензияланатын журналды таңдауға немесе мақаланы бірлесіп қаржыландыруға көмек алыңыз.",
  },
  en: {
    research_proposal:
      "Propose a research topic or initiative in the Aktobe region that requires scientific or practical cooperation.",
    it_request:
      "Request digital development, research workflow automation, database creation or specialized software tools.",
    publication_support:
      "Get assistance preparing a manuscript for publication, selecting a peer-reviewed journal or funding article fees.",
  },
};

const kindIcons: Record<SupportKind, typeof FlaskConical> = {
  research_proposal: FlaskConical,
  it_request: Cpu,
  publication_support: BookOpen,
};

export default async function Page({ params }: { params: LocaleParams }) {
  const locale = requireLocale((await params).locale);
  const copy = supportCopy[locale];

  return (
    <>
      <PublicHeader
        locale={locale}
        section="journal"
        paths={Object.fromEntries(locales.map((l) => [l, `/${l}/support`]))}
      />
      <main className="support-page">
        <section className="journal-hero" style={{ marginBottom: "28px", padding: 0 }}>
          <div className="journal-hero-inner" style={{ maxWidth: "100%", padding: 0 }}>
            <p className="journal-eyebrow" style={{ color: "var(--forest-bright)" }}>
              {locale === "ru"
                ? "Помощь учёным и институтам"
                : locale === "kk"
                  ? "Ғалымдар мен институттарға көмек"
                  : "Assistance for researchers"}
            </p>
            <h1>{copy.title}</h1>
            <p style={{ fontSize: "15px", color: "#475569", lineHeight: 1.6 }}>{copy.intro}</p>
          </div>
        </section>

        <nav
          className="support-cards"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            margin: "24px 0",
          }}
        >
          {supportKinds.map((kind) => {
            const Icon = kindIcons[kind];
            const desc = kindDescriptions[locale][kind];

            return (
              <Link
                key={kind}
                href={`/${locale}/support/${kind}`}
                className="public-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "24px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
              >
                <div>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "rgba(0, 152, 182, 0.08)",
                      color: "var(--forest-bright)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "14px",
                    }}
                  >
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>
                    {copy.kinds[kind]}
                  </h2>
                  <p style={{ fontSize: "13.5px", color: "#64748b", lineHeight: 1.5, margin: 0 }}>
                    {desc}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginTop: "18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--forest-bright)",
                  }}
                >
                  <span>{copy.submit}</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "32px", borderTop: "1px solid #f1f5f9", paddingTop: "20px" }}>
          <Link
            href={`/${locale}/account/support`}
            className="secondary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <User size={15} aria-hidden="true" />
            <span>{copy.own}</span>
          </Link>
        </div>
      </main>
    </>
  );
}
