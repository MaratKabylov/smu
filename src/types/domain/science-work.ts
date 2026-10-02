import type { ScientistLocale, ScientistTaxonomy, ScientistTaxonomyItem } from "./scientist";

export const scienceWorkKinds = ["research", "project"] as const;
export type ScienceWorkKind = (typeof scienceWorkKinds)[number];
export const scienceWorkStatuses = ["draft", "published", "archived"] as const;
export type ScienceWorkStatus = (typeof scienceWorkStatuses)[number];
export const scienceWorkStages = ["planned", "active", "completed"] as const;
export type ScienceWorkStage = (typeof scienceWorkStages)[number];
export type ScienceWorkTranslation = {
  locale: ScientistLocale;
  title: string;
  slug: string;
  summary: string;
  description: string;
  results: string;
};
export type ScienceWorkMember = {
  id: string;
  role: "lead" | "member";
  translations: { locale: ScientistLocale; fullName: string; slug: string }[];
};
export type ScienceWork = {
  id: string;
  kind: ScienceWorkKind;
  status: ScienceWorkStatus;
  stage: ScienceWorkStage;
  organizationId: string | null;
  fieldId: string;
  coverMediaId: string | null;
  coverUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  externalUrl: string | null;
  doi: string | null;
  updatedAt: string;
  deletedAt: string | null;
  translations: ScienceWorkTranslation[];
  members: ScienceWorkMember[];
  organization: ScientistTaxonomyItem | null;
  field: ScientistTaxonomyItem | null;
};
export type ScienceWorkOptions = ScientistTaxonomy & {
  scientists: { id: string; name: string }[];
};
