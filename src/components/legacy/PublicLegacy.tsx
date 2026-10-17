import Link from "next/link";
import { notFound } from "next/navigation";
import { legacyCopy } from "@/lib/i18n/scientific-legacy";
import { locales } from "@/lib/i18n/locales";
import { requireLocale } from "@/lib/i18n/server";
import { accountPageNumber, accountRecordIdSchema } from "@/lib/validation/account-records";
import { legacyKinds, legacyKindSchema } from "@/lib/validation/scientific-legacy";
import { ScientificLegacyService } from "@/server/services/scientific-legacy.service";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { absoluteUrl } from "@/lib/seo/site";
import type { Metadata } from "next";

export type LegacyPublicProps = { params: Promise<{ locale: string; id?: string }>; searchParams?: Promise<{ page?: string | string[]; kind?: string | string[] }> };
export async function legacyMetadata({ params, searchParams }: LegacyPublicProps): Promise<Metadata> {
  const { locale: language, id } = await params;
  const locale = requireLocale(language);
  if (id && !accountRecordIdSchema.safeParse(id).success) notFound();
  const query = await searchParams;
  const page = accountPageNumber(query?.page);
  const copy = legacyCopy[locale];
  const path = `/mentorship/legacy${id ? `/${id}` : ""}`;
  // Metadata is deliberately independent of source fields and consent.
  return { title: copy.title, description: copy.intro, alternates: { canonical: absoluteUrl(`/${locale}${path}${!id && page > 1 ? `?page=${page}` : ""}`), ...(!id ? { languages: Object.fromEntries(locales.map(l => [l, absoluteUrl(`/${l}${path}`)])) } : {}) }, robots: query?.kind && query.kind !== "all" ? { index: false, follow: true } : { index: true, follow: true } };
}
export async function PublicLegacy({ params, searchParams }: LegacyPublicProps) {
  const route = await params;
  const locale = requireLocale(route.locale);
  const id = route.id ?? null;
  if (id && !accountRecordIdSchema.safeParse(id).success) notFound();
  const query = await searchParams;
  const page = id ? 1 : accountPageNumber(query?.page);
  const kind = legacyKindSchema.safeParse(query?.kind);
  const copy = legacyCopy[locale];
  const base = `/${locale}/mentorship/legacy`;
  let data;
  try { data = await new ScientificLegacyService().public(locale, page, id, kind.success ? kind.data : "all"); }
  catch { return <><PublicHeader locale={locale} section="mentorship" paths={Object.fromEntries(locales.map(l => [l, `/${l}/mentorship/legacy`]))} /><main className="journal-catalog"><h1>{copy.title}</h1><p role="alert">{copy.unavailable}</p></main></>; }
  if (id && !data.items.length) notFound();
  return <><PublicHeader locale={locale} section="mentorship" paths={Object.fromEntries(locales.map(l => [l, `/${l}/mentorship/legacy`]))} /><main className="journal-catalog legacy-public">
    <Link href={`/${locale}/mentorship`}>{copy.back}</Link><h1>{copy.title}</h1><p>{copy.intro}</p><Link href={`/${locale}/account/legacy`}>{copy.create}</Link>
    {!id && <form className="science-filters" action={base}><label>{copy.type}<select name="kind" defaultValue={kind.success ? kind.data : "all"}><option value="all">{copy.all}</option>{legacyKinds.map(k => <option key={k} value={k}>{copy.kinds[k]}</option>)}</select></label><button>{copy.find}</button></form>}
    {!data.items.length && <p>{copy.empty}</p>}
    <div className="public-article-grid">{data.items.map(record => {
      const t = record.translations.find(t => t.locale === locale)!;
      return <article className="public-article-card" key={record.id}><div className="public-card-content"><p>{copy.kinds[record.kind]}</p><h2>{id ? t.title : <Link href={`${base}/${record.id}`}>{t.title}</Link>}</h2><p className="legacy-text">{t.description}</p>
        {id && <section><h3>{copy.source}</h3>{record.sourceText || record.sourceUrl ? <>{record.sourceText && <p className="legacy-text">{record.sourceText}</p>}{record.sourceUrl && <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{copy.sourceUrl}</a>}</> : <p>{copy.privateSource}</p>}</section>}
      </div></article>;
    })}</div>
    {id ? <Link href={base}>{copy.back}</Link> : <nav className="account-links" aria-label={copy.title}>{page > 1 && <Link href={`${base}?page=${page - 1}&kind=${kind.success ? kind.data : "all"}`}>{copy.previous}</Link>}{page * 20 < data.total && <Link href={`${base}?page=${page + 1}&kind=${kind.success ? kind.data : "all"}`}>{copy.next}</Link>}</nav>}
  </main></>;
}
