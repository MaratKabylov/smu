import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ArticleLocale } from "@/types/domain/article";

export function JournalHeader({ locale = "ru" }: { locale?: ArticleLocale }) {
  return (
    <header className="journal-header">
      <div className="journal-header-inner">
        <Link className="journal-brand" href={`/journal?lang=${locale}`}>
          <span className="journal-brand-mark">СМУ</span>
          <span>
            <strong>Журнал молодых учёных</strong>
            <small>Актюбинская область</small>
          </span>
        </Link>
        <nav className="journal-nav" aria-label="Основная навигация">
          <Link href={`/journal?lang=${locale}`}>Все материалы</Link>
          <Link href={`/scientists?lang=${locale}`}>Учёные</Link>
        <Link href={`/research?lang=${locale}`}>{locale === "ru" ? "Исследования" : "Зерттеулер"}</Link>
        <Link href={`/projects?lang=${locale}`}>{locale === "ru" ? "Проекты" : "Жобалар"}</Link>
        <Link href={`/research-program?lang=${locale}`}>{locale === "ru" ? "Research Program" : "Зерттеу бағдарламасы"}</Link>
        <Link href={`/mentorship?lang=${locale}`}>{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</Link>

          <a href="/admin" target="_blank" rel="noreferrer">
            SMU Admin <ArrowUpRight aria-hidden="true" />
          </a>
        </nav>
        <div className="journal-language" aria-label="Выбор языка">
          <Link className={locale === "ru" ? "is-active" : ""} href="/journal?lang=ru">RU</Link>
          <Link className={locale === "kk" ? "is-active" : ""} href="/journal?lang=kk">ҚАЗ</Link>
        </div>
      </div>
    </header>
  );
}
