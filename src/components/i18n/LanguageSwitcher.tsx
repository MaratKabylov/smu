"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { languageSwitchPath, locales, type Locale, type PublicSection } from "@/lib/i18n/locales";

export function LanguageSwitcher({ locale, section, paths, label }: {
  locale: Locale; section: PublicSection; paths?: Partial<Record<Locale, string>>; label: string;
}) {
  const query = useSearchParams();
  return <div className="journal-language" aria-label={label}>
    {locales.map(language => <Link key={language} href={languageSwitchPath(section, language, new URLSearchParams(query.toString()), paths)}
      className={language === locale ? "is-active" : ""} hrefLang={language} lang={language} aria-current={language === locale ? "page" : undefined}>
      {language === "ru" ? "RU" : "ҚАЗ"}
    </Link>)}
  </div>;
}
