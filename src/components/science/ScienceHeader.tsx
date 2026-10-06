import { PublicHeader } from "@/components/i18n/PublicHeader";
import type { ScienceWorkKind, ScienceWorkTranslation } from "@/types/domain/science-work";
import type { ScientistLocale } from "@/types/domain/scientist";
export function ScienceHeader({ kind, locale, translations }: { kind: ScienceWorkKind; locale: ScientistLocale; translations?: ScienceWorkTranslation[] }) {
  return <PublicHeader locale={locale} section={kind === "project" ? "projects" : "research"} translations={translations} />;
}
