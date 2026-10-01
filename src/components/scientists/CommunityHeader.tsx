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
        <a href="/admin" target="_blank" rel="noreferrer">SMU Admin <ArrowUpRight aria-hidden="true" /></a>
      </nav>
      <div className="journal-language" aria-label={locale === "ru" ? "Выбор языка" : "Тілді таңдау"}>
        <Link className={locale === "ru" ? "is-active" : ""} href="/scientists?lang=ru">RU</Link>
        <Link className={locale === "kk" ? "is-active" : ""} href="/scientists?lang=kk">ҚАЗ</Link>
      </div>
    </div>
  </header>;
}
