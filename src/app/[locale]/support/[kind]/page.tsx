import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { SupportForm } from "@/components/support/SupportForm";
import { supportCopy } from "@/lib/i18n/support-request";
import { locales } from "@/lib/i18n/locales";
import { requireLocale } from "@/lib/i18n/server";
import { supportKindSchema } from "@/lib/validation/support-request";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string; kind: string }> }) {
  const route = await params; const locale = requireLocale(route.locale); const kind = supportKindSchema.safeParse(route.kind);
  if (!kind.success) notFound();
  const copy = supportCopy[locale];
  return <><PublicHeader locale={locale} section="journal" paths={Object.fromEntries(locales.map(l => [l, `/${l}/support/${kind.data}`]))} /><main className="support-page"><Link href={`/${locale}/support`}>{copy.back}</Link><h1>{copy.kinds[kind.data]}</h1><SupportForm locale={locale} kind={kind.data} /></main></>;
}
