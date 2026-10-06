import { PublicHeader } from "@/components/i18n/PublicHeader";
import type { ArticleLocale } from "@/types/domain/article";

export function JournalHeader({ locale = "ru", translations }: { locale?: ArticleLocale; translations?: { locale: ArticleLocale; slug: string }[] }) {
  return <PublicHeader locale={locale} section="journal" translations={translations} />;
}
