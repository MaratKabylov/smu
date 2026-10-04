import Link from "next/link";
import { PublicationService } from "@/server/services/publication.service";
import { JournalHeader } from "@/components/journal/JournalHeader";
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const locale = (await searchParams).lang === "kk" ? "kk" : "ru";
  const publications = await new PublicationService().listPublic(locale);
  return <><JournalHeader locale={locale} /><main className="public-article-page"><div className="public-article-shell"><h1>{locale === "ru" ? "Научные публикации" : "Ғылыми жарияланымдар"}</h1>
    <nav className="preview-links"><Link href="?lang=ru">Русский</Link><Link href="?lang=kk">Қазақша</Link></nav>
    <section className="public-relations"><ul>{publications.map(item => <li key={item.id}><Link href={`/publications/${locale}/${item.id}`}>{item.title}</Link><p>{item.year} · {item.journal}</p><Link href={item.scientistHref}>{item.scientistName}</Link></li>)}</ul>{!publications.length ? <p>{locale === "ru" ? "Публикаций пока нет." : "Жарияланымдар әзірге жоқ."}</p> : null}</section>
  </div></main></>;
}
