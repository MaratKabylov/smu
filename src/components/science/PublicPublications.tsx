import Link from "next/link";
import { PublicationService } from "@/server/services/publication.service";
import type { ArticleLocale } from "@/types/domain/article";
export async function ScientistPublications({ id, locale }: { id: string; locale: ArticleLocale }) {
  const publications = await new PublicationService().listPublic(locale, null, id);
  if (!publications.length) return null;
  return <section className="public-relations"><h2>{locale === "ru" ? "Научные публикации" : "Ғылыми жарияланымдар"}</h2><ul>
    {publications.map(item => <li key={item.id}><Link href={`/${locale}/publications/${item.id}`}>{item.title}</Link><p>{item.year} · {item.journal}</p></li>)}
  </ul></section>;
}
