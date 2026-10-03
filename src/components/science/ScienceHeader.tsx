import Link from "next/link";
import { scienceWorkPath, scienceWorkTitles } from "@/lib/science-work";
import type { ScienceWorkKind, ScienceWorkTranslation } from "@/types/domain/science-work";
import type { ScientistLocale } from "@/types/domain/scientist";
export function ScienceHeader({ kind, locale, translations }: { kind: ScienceWorkKind; locale: ScientistLocale; translations?: ScienceWorkTranslation[] }) {
  const languageUrl = (language: ScientistLocale) => {
    const translation = translations?.find(item => item.locale === language);
    return scienceWorkPath(kind) + (translation ? "/" + language + "/" + translation.slug : "?lang=" + language);
  };
  return <header className="journal-header"><div className="journal-header-inner">
    <Link className="journal-brand" href={scienceWorkPath(kind) + "?lang=" + locale}><span className="journal-brand-mark">СМУ</span><span><strong>{scienceWorkTitles[locale][kind]}</strong><small>{locale === "ru" ? "Актюбинская область" : "Ақтөбе облысы"}</small></span></Link>
    <nav className="journal-nav" aria-label={locale === "ru" ? "Основная навигация" : "Негізгі навигация"}><Link href={"/scientists?lang=" + locale}>{locale === "ru" ? "Учёные" : "Ғалымдар"}</Link><Link href={"/research?lang=" + locale} aria-current={kind === "research" ? "page" : undefined}>{scienceWorkTitles[locale].research}</Link><Link href={"/projects?lang=" + locale} aria-current={kind === "project" ? "page" : undefined}>{locale === "ru" ? "Проекты" : "Жобалар"}</Link><Link href={"/mentorship?lang=" + locale}>{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</Link><Link href={"/journal?lang=" + locale}>Журнал</Link></nav>
    <div className="journal-language" aria-label={locale === "ru" ? "Выбор языка" : "Тілді таңдау"}><Link href={languageUrl("ru")} className={locale === "ru" ? "is-active" : ""}>RU</Link><Link href={languageUrl("kk")} className={locale === "kk" ? "is-active" : ""}>ҚАЗ</Link></div>
  </div></header>;
}
