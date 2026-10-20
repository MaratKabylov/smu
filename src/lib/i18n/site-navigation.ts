import type { Locale } from "./locales";
import type { PageKey } from "@/lib/validation/site-content";

export const publicInformationPageKeys = ["about", "foundation", "team", "partners", "documents", "contacts"] as const satisfies readonly PageKey[];
export type PublicInformationPageKey = (typeof publicInformationPageKeys)[number];

export const publicInformationNavigation = {
  ru: {
    label: "О СМУ",
    pages: { about: "О СМУ", foundation: "Фонд", team: "Команда", partners: "Партнёры", documents: "Документы", contacts: "Контакты" },
  },
  kk: {
    label: "СМУ туралы",
    pages: { about: "СМУ туралы", foundation: "Қор", team: "Команда", partners: "Серіктестер", documents: "Құжаттар", contacts: "Байланыстар" },
  },
  en: {
    label: "About SMU",
    pages: { about: "About SMU", foundation: "Foundation", team: "Team", partners: "Partners", documents: "Documents", contacts: "Contacts" },
  },
} satisfies Record<Locale, { label: string; pages: Record<PublicInformationPageKey, string> }>;
