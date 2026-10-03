import type { ScientistLocale, ScientistTaxonomyItem } from "./scientist";

export const researchProgramStatuses = ["draft", "published", "archived"] as const;
export const researchProgramFormats = ["online", "offline", "hybrid"] as const;
export const applicationStatuses = ["new", "in_review", "accepted", "rejected", "completed"] as const;
export type ResearchProgramStatus = (typeof researchProgramStatuses)[number];
export type ResearchProgramFormat = (typeof researchProgramFormats)[number];
export type ApplicationStatus = (typeof applicationStatuses)[number];
export type ResearchProgramTranslation = {
  locale: ScientistLocale; title: string; slug: string; summary: string; description: string;
  curriculum: string; eligibility: string; outcomes: string;
};
export type ResearchProgram = {
  id: string; coordinatorId: string; fieldId: string; format: ResearchProgramFormat; capacity: number;
  applicationsOpenOn: string; applicationDeadline: string; startsOn: string; endsOn: string;
  status: ResearchProgramStatus; updatedAt: string; translations: ResearchProgramTranslation[];
  coordinator: { locale: ScientistLocale; fullName: string; slug: string }[];
  field: ScientistTaxonomyItem | null;
};
export type ResearchProgramApplication = {
  id: string; programId: string; locale: ScientistLocale; fullName: string; email: string; motivation: string;
  status: ApplicationStatus; managerNote: string; createdAt: string; consentAt: string;
};
