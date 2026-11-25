import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { SupportForm } from "@/components/support/SupportForm";
import { supportCopy } from "@/lib/i18n/support-request";
import { locales } from "@/lib/i18n/locales";
import { requireLocale } from "@/lib/i18n/server";
import { isOpenDataSupportKind, isScientistSupportKind, supportKindSchema } from "@/lib/validation/support-request";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; kind: string }>;
}) {
  const route = await params;
  const locale = requireLocale(route.locale);
  const kind = supportKindSchema.safeParse(route.kind);
  if (!kind.success) notFound();

  const copy = supportCopy[locale];
  const override = copy.kindOverrides?.[kind.data];
  const isOpenData = isOpenDataSupportKind(kind.data);
  const isScientist = isScientistSupportKind(kind.data);
  const headerSection = isOpenData ? "research" : isScientist ? "scientists" : "journal";
  const backHref = isOpenData
    ? `/${locale}/open-data`
    : isScientist
      ? `/${locale}/scientists`
      : `/${locale}/support`;
  const kicker = isOpenData ? "Open Data Aktobe" : override?.kicker ?? copy.title;

  return (
    <>
      <PublicHeader
        locale={locale}
        section={headerSection}
        paths={Object.fromEntries(locales.map((l) => [l, `/${l}/support/${kind.data}`]))}
      />
      <main className="support-page">
        <Link className="back-link" href={backHref}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{copy.back}</span>
        </Link>
        <div style={{ margin: "16px 0 24px" }}>
          <p
            className="page-kicker"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--forest-bright)",
              margin: "0 0 6px",
            }}
          >
            {kicker}
          </p>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 750, color: "#0f172a" }}>
            {copy.kinds[kind.data]}
          </h1>
          {override?.intro ? (
            <p style={{ margin: "8px 0 0", fontSize: "15px", color: "#475569", lineHeight: 1.55 }}>
              {override.intro}
            </p>
          ) : null}
        </div>
        <SupportForm locale={locale} kind={kind.data} />
      </main>
    </>
  );
}
