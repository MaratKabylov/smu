import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { absoluteUrl } from "@/lib/seo/site";
import { openGraphLocale } from "@/lib/seo/metadata";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { PublicResearchOutputDetail } from "@/components/science/PublicResearchOutputs";
import { ResearchOutputService } from "@/server/services/research-output.service";
import { isLocale, locales, type Locale } from "@/lib/i18n/locales";
import type { ArticleLocale } from "@/types/domain/article";

type Props = { params: Promise<{ locale: string; id: string }> };

const resultByLocale = cache(async (locale: ArticleLocale, id: string) => {
  const [result] = await new ResearchOutputService().listPublic(locale, id);
  const paths: Partial<Record<Locale, string>> = Object.fromEntries(
    locales.map((l) => [l, `/${l}/results/${id}`])
  );
  return { result, paths };
});

async function detail(params: Props["params"]) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const { result, paths } = await resultByLocale(locale as ArticleLocale, id);
  if (!result) notFound();
  return { result, paths, locale: locale as ArticleLocale };
}

export async function generateMetadata({ params }: Props) {
  const { result, paths, locale } = await detail(params);
  const canonical = absoluteUrl(`/${locale}/results/${result.id}`);
  return {
    title: result.title,
    description: result.description.slice(0, 160),
    alternates: {
      canonical,
      languages: Object.fromEntries(
        Object.entries(paths).map(([l, path]) => [l, absoluteUrl(path)])
      ),
      types: { "application/rss+xml": absoluteUrl(`/${locale}/feed.xml`) },
    },
    openGraph: {
      title: result.title,
      description: result.description.slice(0, 160),
      url: canonical,
      locale: openGraphLocale[locale],
    },
  };
}

export default async function Page({ params }: Props) {
  const { result, locale, paths } = await detail(params);

  return (
    <>
      <PublicHeader locale={locale} section="results" paths={paths} />
      <PublicResearchOutputDetail item={result} locale={locale} />
    </>
  );
}
