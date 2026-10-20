import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import { publicInformationNavigation, type PublicInformationPageKey } from "@/lib/i18n/site-navigation";

export function PublicInformationMenu({ locale, pages, current }: {
  locale: Locale;
  pages: readonly PublicInformationPageKey[];
  current?: PublicInformationPageKey;
}) {
  if (!pages.length) return null;
  const copy = publicInformationNavigation[locale];
  return <details className={`public-information-navigation${current ? " is-current" : ""}`}>
    <summary>{copy.label}</summary>
    <div>{pages.map(key => <Link key={key} href={`/${locale}/pages/${key}`} aria-current={current === key ? "page" : undefined}>{copy.pages[key]}</Link>)}</div>
  </details>;
}
