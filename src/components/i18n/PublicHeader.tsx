import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizedPath, locales, publicSections, translationPaths, type Locale, type PublicSection } from "@/lib/i18n/locales";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { searchCopy } from "@/lib/search";
import { accountCopy } from "@/lib/i18n/account";
import { legacyCopy } from "@/lib/i18n/scientific-legacy";
import { supportCopy } from "@/lib/i18n/support-request";
import { homeCopy } from "@/lib/homepage";
import type { PublicInformationPageKey } from "@/lib/i18n/site-navigation";
import { PublicInformationMenu } from "./PublicInformationMenu";
import { PublicInformationNavigation } from "./PublicInformationNavigation";

export function PublicHeader({ locale, section, translations, paths, home = false, contentPage = false, siteName, informationPage }: {
  locale: Locale; section: PublicSection; translations?: readonly { locale: Locale; slug: string }[];
  paths?: Partial<Record<Locale, string>>;
  home?: boolean; contentPage?: boolean; siteName?: string;
  informationPage?: PublicInformationPageKey;
}) {
  const copy = getDictionary(locale).common;
  const languagePaths = paths ?? (home ? Object.fromEntries(locales.map(l => [l, `/${l}`])) : translations ? translationPaths(section, translations) : undefined);
  return <header className="journal-header public-header"><div className="journal-header-inner">
    <Link className="journal-brand" href={localizedPath(locale, home || contentPage ? "/" : `/${section}`)}>
      <span className="journal-brand-mark">СМУ</span><span><strong>{siteName ?? copy.brands[section]}</strong><small>{copy.region}</small></span>
    </Link>
    <nav className="journal-nav" aria-label={copy.navigation}>
      <Link href={`/${locale}`} aria-current={home ? "page" : undefined}>{homeCopy[locale].home}</Link>
      {publicSections.map(item => <Link key={item} href={localizedPath(locale, `/${item}`)} aria-current={!home && !contentPage && item === section ? "page" : undefined}>{copy.sections[item]}</Link>)}
      <Suspense fallback={informationPage ? <PublicInformationMenu locale={locale} pages={[informationPage]} current={informationPage} /> : null}>
        <PublicInformationNavigation locale={locale} current={informationPage} />
      </Suspense>
      {section === "mentorship" && <Link href={`/${locale}/mentorship/legacy`}>{legacyCopy[locale].title}</Link>}
      <Link href={localizedPath(locale, "/search")}>{searchCopy[locale].find}</Link>
      <a href={localizedPath(locale, "/feed.xml")}>RSS</a>
      <Link href={localizedPath(locale, "/account")}>{accountCopy[locale].account}</Link>
      <Link href={`/${locale}/support`}>{supportCopy[locale].title}</Link>
      <a href="/admin" target="_blank" rel="noreferrer">SMU Admin <ArrowUpRight aria-hidden="true" /></a>
    </nav>
    <Suspense fallback={<div className="journal-language" aria-label={copy.language}>{locales.map(language => <Link key={language} href={languagePaths?.[language] ?? localizedPath(language, `/${section}`)} hrefLang={language} className={language === locale ? "is-active" : ""}>{language === "ru" ? "RU" : language === "kk" ? "ҚАЗ" : "EN"}</Link>)}</div>}>
      <LanguageSwitcher locale={locale} section={section} paths={languagePaths} label={copy.language} />
    </Suspense>
  </div></header>;
}
