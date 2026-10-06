import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import Link from "next/link";
import { PublicationService } from "@/server/services/publication.service";
export default async function Page({ params }: { params: LocaleParams }) {
  const locale = requireLocale((await params).locale);
  const publications = await new PublicationService().listPublic(locale);
  return <><PublicHeader locale={locale} section="publications" /><main className="public-article-page"><div className="public-article-shell"><h1>{locale === "ru" ? "Научные публикации" : "Ғылыми жарияланымдар"}</h1>
    <section className="public-relations"><ul>{publications.map(item => <li key={item.id}><Link href={`/${locale}/publications/${item.id}`}>{item.title}</Link><p>{item.year} · {item.journal}</p><Link href={item.scientistHref}>{item.scientistName}</Link></li>)}</ul>{!publications.length ? <p>{locale === "ru" ? "Публикаций пока нет." : "Жарияланымдар әзірге жоқ."}</p> : null}</section>
  </div></main></>;
}
