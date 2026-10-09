import Link from "next/link";
import { PublicationService } from "@/server/services/publication.service";
import type { ArticleLocale } from "@/types/domain/article";
import type { PublicPublication } from "@/types/domain/publication";
const titles = { ru: "Научные публикации", kk: "Ғылыми жарияланымдар", en: "Scientific publications" };
export function PublicationAuthors({ item }: { item: PublicPublication }) {
  const authors = item.authors?.length ? item.authors : [{ scientistId: item.scientistId, name: item.scientistName, href: item.scientistHref, affiliation: "" }];
  return <ul className="publication-authors">{authors.map((a, i) => <li key={a.scientistId ?? i}>{a.href ? <Link href={a.href}>{a.name}</Link> : <span>{a.name}</span>}{a.affiliation ? <small> · {a.affiliation}</small> : null}</li>)}</ul>;
}
function PublicationList({ publications, locale }: { publications: PublicPublication[]; locale: ArticleLocale }) {
  if (!publications.length) return null;
  return <section className="public-relations"><h2>{titles[locale]}</h2><ul>{publications.map(item => <li key={item.id}><Link href={`/${locale}/publications/${item.id}`}>{item.title}</Link><p>{item.year} · {item.journal}</p></li>)}</ul></section>;
}
export async function ScientistPublications({ id, locale }: { id: string; locale: ArticleLocale }) {
  return <PublicationList publications={await new PublicationService().listPublic(locale, null, id)} locale={locale} />;
}
export async function WorkPublications({ id, locale }: { id: string; locale: ArticleLocale }) {
  return <PublicationList publications={await new PublicationService().listPublicByWork(locale, id)} locale={locale} />;
}
