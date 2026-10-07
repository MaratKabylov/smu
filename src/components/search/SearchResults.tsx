import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import { searchCopy, searchSectionLabels, type SearchPage } from "@/lib/search";

export function SearchResults({ result, locale, query }: { result: SearchPage; locale: Locale; query: string }) {
  const text = searchCopy[locale];
  return <section className="platform-search-results" aria-label={text.title}>
    <p aria-live="polite">{text.results}: {result.total}</p>
    {result.items.length ? <ul>{result.items.map(item => <li key={`${item.section}:${item.id}`}>
      <small>{searchSectionLabels[locale][item.section]}</small>
      <h2>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</h2>
      {item.summary ? <p>{item.summary}</p> : null}
    </li>)}</ul> : <p>{query ? text.empty : text.hint}</p>}
  </section>;
}
