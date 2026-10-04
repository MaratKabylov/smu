import type { ArticleAuthorCredit, ArticleLocale } from "@/types/domain/article";
import { articleAuthorRoleLabels } from "@/lib/articles/presentation";

export function ArticleCredits({ authors, locale, detailed = false }: {
  authors: ArticleAuthorCredit[]; locale: ArticleLocale; detailed?: boolean;
}) {
  if (!authors.length) return null;
  return <section className="article-credits" aria-label={locale === "ru" ? "Авторы материала" : "Материал авторлары"}>
    {detailed ? <h2>{locale === "ru" ? "Об авторах" : "Авторлар туралы"}</h2> : null}
    <ul>{authors.map(author => {
      const name = locale === "ru" ? author.nameRu : author.nameKk;
      const bio = locale === "ru" ? author.bioRu : author.bioKk;
      return <li key={author.id}>
        <strong>{name}</strong><span> · {articleAuthorRoleLabels[locale][author.role]}</span>
        {detailed ? <>
          {author.organization || author.position ? <p>{[author.organization, author.position].filter(Boolean).join(" · ")}</p> : null}
          {bio ? <p>{bio}</p> : null}
          {author.websiteUrl && /^https?:\/\//i.test(author.websiteUrl) ? <a href={author.websiteUrl} target="_blank" rel="noopener noreferrer">{locale === "ru" ? "Сайт автора" : "Автордың сайты"}</a> : null}
        </> : null}
      </li>;
    })}</ul>
  </section>;
}
