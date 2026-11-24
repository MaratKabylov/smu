import { Inter } from "next/font/google";
import { siteOrigin, absoluteUrl } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales } from "@/lib/i18n/locales";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const copy = getDictionary(locale).common;
  return {
    metadataBase: new URL(siteOrigin()),
    alternates: { types: { "application/rss+xml": absoluteUrl(`/${locale}/feed.xml`) } },
    title: { default: `СМУ — ${copy.footer}`, template: "%s · СМУ" },
    description: locale === "ru" ? "Цифровая платформа научного сообщества Актюбинской области." : locale === "en" ? "Digital platform for the scientific community of the Aktobe region." : "Ақтөбе облысының ғылыми қауымдастығының цифрлық платформасы.",
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: LocaleParams }) {
  const locale = requireLocale((await params).locale);
  return <html lang={locale}><body className={inter.className}><JsonLd data={organizationJsonLd(locale)} />{children}</body></html>;
}
