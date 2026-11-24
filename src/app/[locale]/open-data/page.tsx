import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { locales } from "@/lib/i18n/locales";
import { absoluteUrl } from "@/lib/seo/site";
import { getPublicSiteContent } from "@/server/services/site-content.service";
import { getPublicOpenData } from "@/server/services/open-data.service";
import { PublicOpenData } from "@/components/open-data/PublicOpenData";

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const [content, openData] = await Promise.all([
    getPublicSiteContent(locale),
    getPublicOpenData(locale),
  ]);

  const title = openData?.title
    ? `${openData.title} · ${content.settings.site_name}`
    : `Open Data Aktobe · ${content.settings.site_name}`;
  const description =
    openData?.shortDescription ??
    "Единая база научных данных Актюбинской области для проведения научных исследований.";

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(`/${locale}/open-data`),
      languages: Object.fromEntries(
        locales.map((l) => [l, absoluteUrl(`/${l}/open-data`)])
      ),
    },
  };
}

export default async function OpenDataPage({
  params,
}: {
  params: LocaleParams;
}) {
  const locale = requireLocale((await params).locale);
  const [content, data] = await Promise.all([
    getPublicSiteContent(locale),
    getPublicOpenData(locale),
  ]);

  if (!data || !data.isPublished) {
    notFound();
  }

  return (
    <PublicOpenData
      data={data}
      locale={locale}
      siteName={content.settings.site_name}
    />
  );
}
