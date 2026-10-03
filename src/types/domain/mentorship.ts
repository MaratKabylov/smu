import type { ScientistLocale, ScientistTaxonomyItem } from "./scientist";

export const mentorshipStatuses = ["draft", "published", "archived"] as const;
export const mentorshipFormats = ["online", "offline", "hybrid"] as const;
export const applicationStatuses = ["new", "in_review", "accepted", "rejected", "completed"] as const;
export type MentorshipStatus = (typeof mentorshipStatuses)[number];
export type MentorshipFormat = (typeof mentorshipFormats)[number];
export type ApplicationStatus = (typeof applicationStatuses)[number];
export type MentorshipTranslation = { locale: ScientistLocale; title: string; slug: string; summary: string; description: string };
export type MentorshipOffer = {
  id: string; scientistId: string; fieldId: string; format: MentorshipFormat; capacity: number;
  status: MentorshipStatus; updatedAt: string; translations: MentorshipTranslation[];
  mentor: { locale: ScientistLocale; fullName: string; slug: string }[];
  field: ScientistTaxonomyItem | null;
};
export type MentorshipApplication = {
  id: string; offerId: string; locale: ScientistLocale; fullName: string; email: string; motivation: string;
  status: ApplicationStatus; managerNote: string; createdAt: string; consentAt: string;
};
