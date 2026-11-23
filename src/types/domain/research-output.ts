import type { ResearchOutputInput } from "@/lib/validation/research-output";

export const researchOutputKinds = [
  "dataset",
  "report",
  "map",
  "atlas",
  "methodology",
  "recommendation",
  "dashboard",
  "software",
  "archive",
] as const;

export type ResearchOutputKind = (typeof researchOutputKinds)[number];

export const researchOutputLabels = {
  ru: {
    dataset: "Набор данных",
    report: "Отчёт",
    map: "Карта",
    atlas: "Атлас",
    methodology: "Методика",
    recommendation: "Рекомендации",
    dashboard: "Панель данных",
    software: "Программное обеспечение",
    archive: "Архив",
  },
  kk: {
    dataset: "Деректер жиынтығы",
    report: "Есеп",
    map: "Карта",
    atlas: "Атлас",
    methodology: "Әдістеме",
    recommendation: "Ұсынымдар",
    dashboard: "Деректер панелі",
    software: "Бағдарламалық жасақтама",
    archive: "Мұрағат",
  },
  en: {
    dataset: "Dataset",
    report: "Report",
    map: "Map",
    atlas: "Atlas",
    methodology: "Methodology",
    recommendation: "Recommendations",
    dashboard: "Dashboard",
    software: "Software",
    archive: "Archive",
  },
};

export type ResearchOutputItem = {
  id: string;
  ownerId: string;
  kind: ResearchOutputKind;
  status: "draft" | "published" | "archived";
  version: number;
  publishedAt?: string | null;
  updatedAt: string;
  input: ResearchOutputInput;
};

export type PublicResearchOutputItem = {
  id: string;
  kind: ResearchOutputKind;
  version: number;
  versionLabel: string;
  license: string;
  title: string;
  description: string;
  externalUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  works?: { id: string; kind: "research" | "project"; title: string }[];
  files: { id: string; name: string; size: number; mimeType: string }[];
};
