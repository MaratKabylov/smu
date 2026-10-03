import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ScientistLocale } from "@/types/domain/scientist";

export function CommunityHeader({ locale = "ru" }: { locale?: ScientistLocale }) {
  return <header className="journal-header">
    <div className="journal-header-inner">
      <Link className="journal-brand" href={`/scientists?lang=${locale}`}>
        <span className="journal-brand-mark">СМУ</span>
        <span><strong>{locale === "ru" ? "Научное сообщество" : "Ғылыми қауымдастық"}</strong><small>{locale === "ru" ? "Актюбинская область" : "Ақтөбе облысы"}</small></span>
      </Link>
      <nav className="journal-nav" aria-label={locale === "ru" ? "Основная навигация" : "Негізгі навигация"}>
        <Link href={`/scientists?lang=${locale}`}>{locale === "ru" ? "Учёные" : "Ғалымдар"}</Link>
        <Link href={`/journal?lang=${locale}`}>{locale === "ru" ? "Журнал" : "Журнал"}</Link>
        <Link href={`/research?lang=${locale}`}>{locale === "ru" ? "Исследования" : "Зерттеулер"}</Link>
        <Link href={`/projects?lang=${locale}`}>{locale === "ru" ? "Проекты" : "Жобалар"}</Link>
        <Link href={`/research-program?lang=${locale}`}>{locale === "ru" ? "Research Program" : "Зерттеу бағдарламасы"}</Link>
        <Link href={`/mentorship?lang=${locale}`}>{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</Link>

        <a href="/admin" target="_blank" rel="noreferrer">SMU Admin <ArrowUpRight aria-hidden="true" /></a>
        <Link href={"/events?lang=" + locale}>{locale === "ru" ? "События" : "Іс-шаралар"}</Link>
      </nav>
      <div className="journal-language" aria-label={locale === "ru" ? "Выбор языка" : "Тілді таңдау"}>
        <Link className={locale === "ru" ? "is-active" : ""} href="/scientists?lang=ru">RU</Link>
        <Link className={locale === "kk" ? "is-active" : ""} href="/scientists?lang=kk">ҚАЗ</Link>
      </div>
    </div>
  </header>;
}
