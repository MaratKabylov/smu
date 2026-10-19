import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicContentPage } from "@/components/content/PublicContentPage";
import { requireLocale } from "@/lib/i18n/server";
import { pageKeys } from "@/lib/validation/site-content";
import { absoluteUrl } from "@/lib/seo/site";
import { getPublicSiteContent } from "@/server/services/site-content.service";

type Props = { params: Promise<{ locale: string; key: string }> };
async function read(params: Props["params"]) {
  await connection();
  const { locale: raw, key } = await params;
  const locale = requireLocale(raw);
  if (!pageKeys.some(value => value === key)) notFound();
  const content = await getPublicSiteContent(locale, key);
  if (!content.page) notFound();
  return { content, locale, page: content.page };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page, locale } = await read(params);
  return { title: page.title, description: page.summary, alternates: {
    canonical: absoluteUrl(`/${locale}/pages/${page.key}`),
    languages: Object.fromEntries(page.locales.map(language => [language, absoluteUrl(`/${language}/pages/${page.key}`)])),
  } };
}
export default async function Page({ params }: Props) {
  const { content, locale } = await read(params);
  return <PublicContentPage content={content} locale={locale} />;
}
