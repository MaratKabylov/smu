import Link from "next/link";
import type { Locale, PublicQuery } from "@/lib/i18n/locales";
import { pageHref, searchCopy } from "@/lib/search";

export function Pagination({ total, page, pageSize, path, query, locale }: {
  total: number; page: number; pageSize: number; path: string; query: PublicQuery; locale: Locale;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1 && page === 1) return null;
  const text = searchCopy[locale];
  const visible = [...new Set([1, ...[page - 1, page, page + 1].filter(value => value >= 1 && value <= pages), pages])].filter(value => value > 0).sort((a, b) => a - b);
  return <nav className="catalog-pagination" aria-label={text.pagination}>
    {page > 1 ? <Link href={pageHref(path, query, Math.min(page - 1, Math.max(pages, 1)))} rel="prev">{text.previous}</Link> : null}
    {visible.map((value, index) => <span key={value}>
      {index > 0 && value - visible[index - 1] > 1 ? <span aria-hidden="true">… </span> : null}
      {value === page ? <span aria-current="page">{value}</span> : <Link href={pageHref(path, query, value)}>{value}</Link>}
    </span>)}
    {page < pages ? <Link href={pageHref(path, query, page + 1)} rel="next">{text.next}</Link> : null}
  </nav>;
}
