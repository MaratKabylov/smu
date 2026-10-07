import type { Locale } from "./locales";
import type { ScientistOrganization, ScientistTaxonomyItem } from "@/types/domain/scientist";

export function scientistTaxonomyName(item: ScientistTaxonomyItem, locale: Locale) {
  if (locale === "en") return item.nameEn ?? item.nameRu;
  return locale === "kk" ? item.nameKk : item.nameRu;
}

export function scientistOrganizationCity(item: ScientistOrganization, locale: Locale) {
  if (locale === "en") return item.cityEn ?? item.cityRu;
  return locale === "kk" ? item.cityKk : item.cityRu;
}
