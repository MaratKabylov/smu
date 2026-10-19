import type { Metadata } from "next";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { locales, type PublicQuery } from "@/lib/i18n/locales";
import { getPublicHomepage } from "@/server/services/homepage.service";
import { getPublicSiteContent } from "@/server/services/site-content.service";
import { PublicHomepage } from "@/components/content/PublicHomepage";
import { homeCopy } from "@/lib/homepage";
import { absoluteUrl } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const { settings } = await getPublicSiteContent(locale);
  return { title: settings.site_name, description: homeCopy[locale].intro,
    alternates: { canonical: absoluteUrl(`/${locale}`), languages: Object.fromEntries(locales.map(l => [l, absoluteUrl(`/${l}`)])) } };
}

export default async function Home({ params }: { params: LocaleParams; searchParams?: Promise<PublicQuery> }) {
  const locale = requireLocale((await params).locale);
  return <PublicHomepage locale={locale} data={await getPublicHomepage(locale)} />;
}
