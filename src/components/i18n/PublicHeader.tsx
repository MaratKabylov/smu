import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Menu } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizedPath, locales, translationPaths, type Locale, type PublicSection } from "@/lib/i18n/locales";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { searchCopy } from "@/lib/search";
import { accountCopy } from "@/lib/i18n/account";
import { legacyCopy } from "@/lib/i18n/scientific-legacy";
import type { PublicInformationPageKey } from "@/lib/i18n/site-navigation";

const headerCopy = {
  ru: { menu: "Открыть меню", apply: "Подать заявку", tasks: "Задачи региона", science: "IT for Science", about: "О Совете" },
  kk: { menu: "Мәзірді ашу", apply: "Өтінім беру", tasks: "Өңір міндеттері", science: "IT for Science", about: "Кеңес туралы" },
  en: { menu: "Open menu", apply: "Apply now", tasks: "Regional challenges", science: "IT for Science", about: "About the Council" },
} as const;

const secondarySections = ["journal", "publications", "results", "mentorship", "research-program", "events"] as const;

function Brand({ locale, label }: { locale: Locale; label: string }) {
  const russian = locale === "ru";
  return <Link className="journal-brand" href={`/${locale}`} aria-label={label}>
    <span className="public-logo-crop">
      <Image
        className="public-logo"
        src={russian ? "/images/smu-logo-ru.png" : "/images/smu-logo-kk.png"}
        width={1448}
        height={1086}
        sizes="(max-width: 760px) 176px, 205px"
        alt={russian ? "Совет молодых учёных" : "Жас ғалымдар кеңесі"}
        priority
      />
    </span>
  </Link>;
}

function HeaderLinks({ locale, section, contentPage, informationPage }: {
  locale: Locale;
  section: PublicSection;
  contentPage: boolean;
  informationPage?: PublicInformationPageKey;
}) {
  const copy = getDictionary(locale).common;
  const text = headerCopy[locale];
  const current = (item: PublicSection) => !contentPage && item === section ? "page" as const : undefined;
  return <>
    <Link href={localizedPath(locale, "/scientists")} aria-current={current("scientists")}>{copy.sections.scientists}</Link>
    <Link href={localizedPath(locale, "/research")} aria-current={current("research")}>{copy.sections.research}</Link>
    <Link href={localizedPath(locale, "/projects")} aria-current={current("projects")}>{text.tasks}</Link>
    <Link href={`/${locale}/support/it_request`}>{text.science}</Link>
    <Link href={localizedPath(locale, "/opportunities")} aria-current={current("opportunities")}>{copy.sections.opportunities}</Link>
    <Link href={`/${locale}/pages/about`} aria-current={informationPage ? "page" : undefined}>{text.about}</Link>
  </>;
}

export function PublicHeader({ locale, section, translations, paths, home = false, contentPage = false, siteName, informationPage }: {
  locale: Locale; section: PublicSection; translations?: readonly { locale: Locale; slug: string }[];
  paths?: Partial<Record<Locale, string>>;
  home?: boolean; contentPage?: boolean; siteName?: string;
  informationPage?: PublicInformationPageKey;
}) {
  const copy = getDictionary(locale).common;
  const text = headerCopy[locale];
  const languagePaths = paths ?? (home ? Object.fromEntries(locales.map(language => [language, `/${language}`])) : translations ? translationPaths(section, translations) : undefined);
  const languageFallback = <div className="journal-language" aria-label={copy.language}>{locales.map(language => <Link key={language} href={languagePaths?.[language] ?? localizedPath(language, `/${section}`)} hrefLang={language} className={language === locale ? "is-active" : ""}>{language === "ru" ? "RU" : language === "kk" ? "ҚАЗ" : "EN"}</Link>)}</div>;

  return <header className="journal-header public-header"><div className="journal-header-inner">
    <Brand locale={locale} label={siteName ?? copy.footer} />
    <nav className="journal-nav public-primary-nav" aria-label={copy.navigation}>
      <HeaderLinks locale={locale} section={section} contentPage={home || contentPage} informationPage={informationPage} />
    </nav>
    <div className="public-header-tools">
      <Suspense fallback={languageFallback}>
        <LanguageSwitcher locale={locale} section={section} paths={languagePaths} label={copy.language} />
      </Suspense>
      <Link className="public-header-cta" href={`/${locale}/support/research_proposal`}>{text.apply}</Link>
      <details className="public-mobile-menu">
        <summary aria-label={text.menu}><Menu aria-hidden="true" /></summary>
        <nav aria-label={copy.navigation}>
          <div className="public-mobile-languages" aria-label={copy.language}>
            {locales.map(language => <Link key={language} href={languagePaths?.[language] ?? localizedPath(language, `/${section}`)} hrefLang={language} lang={language} aria-current={language === locale ? "page" : undefined}>{language === "ru" ? "RU" : language === "kk" ? "ҚАЗ" : "EN"}</Link>)}
          </div>
          <HeaderLinks locale={locale} section={section} contentPage={home || contentPage} informationPage={informationPage} />
          {secondarySections.map(item => <Link key={item} href={localizedPath(locale, `/${item}`)} aria-current={!home && !contentPage && item === section ? "page" : undefined}>{copy.sections[item]}</Link>)}
          {section === "mentorship" && <Link href={`/${locale}/mentorship/legacy`}>{legacyCopy[locale].title}</Link>}
          <Link href={localizedPath(locale, "/search")}>{searchCopy[locale].find}</Link>
          <Link href={localizedPath(locale, "/account")}>{accountCopy[locale].account}</Link>
          <Link href={`/${locale}/support/research_proposal`}>{text.apply}</Link>
        </nav>
      </details>
    </div>
  </div></header>;
}
