import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizedPath, locales, publicSections, translationPaths, type Locale, type PublicSection } from "@/lib/i18n/locales";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { searchCopy } from "@/lib/search";

export function PublicHeader({ locale, section, translations, paths }: {
  locale: Locale; section: PublicSection; translations?: readonly { locale: Locale; slug: string }[];
  paths?: Partial<Record<Locale, string>>;
}) {
  const copy = getDictionary(locale).common;
  const languagePaths = paths ?? (translations ? translationPaths(section, translations) : undefined);
  return <header className="journal-header public-header"><div className="journal-header-inner">
    <Link className="journal-brand" href={localizedPath(locale, `/${section}`)}>
      <span className="journal-brand-mark">СМУ</span><span><strong>{copy.brands[section]}</strong><small>{copy.region}</small></span>
    </Link>
    <nav className="journal-nav" aria-label={copy.navigation}>
      {publicSections.map(item => <Link key={item} href={localizedPath(locale, `/${item}`)} aria-current={item === section ? "page" : undefined}>{copy.sections[item]}</Link>)}
      <Link href={localizedPath(locale, "/search")}>{searchCopy[locale].find}</Link>
      <a href={localizedPath(locale, "/feed.xml")}>RSS</a>
      <a href="/admin" target="_blank" rel="noreferrer">SMU Admin <ArrowUpRight aria-hidden="true" /></a>
    </nav>
    <Suspense fallback={<div className="journal-language" aria-label={copy.language}>{locales.map(language => <Link key={language} href={languagePaths?.[language] ?? localizedPath(language, `/${section}`)} hrefLang={language} className={language === locale ? "is-active" : ""}>{language === "ru" ? "RU" : "ҚАЗ"}</Link>)}</div>}>
      <LanguageSwitcher locale={locale} section={section} paths={languagePaths} label={copy.language} />
    </Suspense>
  </div></header>;
}
