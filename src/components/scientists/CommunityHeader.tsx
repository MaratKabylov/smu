import { PublicHeader } from "@/components/i18n/PublicHeader";
import type { ScientistLocale } from "@/types/domain/scientist";

export function CommunityHeader({ locale = "ru", translations }: { locale?: ScientistLocale; translations?: { locale: ScientistLocale; slug: string }[] }) {
  return <PublicHeader locale={locale} section="scientists" translations={translations} />;
}
