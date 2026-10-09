import type { Collaboration, ScientistLink, VerificationStatus } from "@/lib/scientists/profile";
import type { Locale } from "@/lib/i18n/locales";
export const scientistStatuses = ["draft", "verified"] as const;
export type ScientistStatus = (typeof scientistStatuses)[number];
export type ScientistLocale = Locale;
export const scientificOrganizationTypes = [
  "university",
  "research_center",
  "hospital",
  "company",
  "government",
  "ngo",
  "school",
  "other",
] as const;
export type ScientificOrganizationType = (typeof scientificOrganizationTypes)[number];

export type ScientistTaxonomyItem = {
  id: string;
  slug: string;
  nameRu: string;
  nameKk: string;
  nameEn?: string | null;
  isActive: boolean;
  parentId: string | null;
  updatedAt: string;
};

export type ScientistOrganization = ScientistTaxonomyItem & {
  cityRu: string | null;
  cityKk: string | null;
  cityEn?: string | null;
  websiteUrl: string | null;
  logoMediaId: string | null;
  organizationType: ScientificOrganizationType;
};

export type ScientistTranslation = {
  id: string;
  locale: ScientistLocale;
  fullName: string;
  slug: string;
  position: string;
  academicDegree: string | null;
  shortBio: string;
  biography: string;
};

export type ScientistProfile = {
  id: string;
  userId: string | null;
  organizationId: string | null;
  organization: ScientistOrganization | null;
  avatarMediaId: string | null;
  avatarUrl: string | null;
  status: ScientistStatus;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  isPublic: boolean;
  collaboration: Collaboration;
  links: ScientistLink[];
  contentVersion: number;
  mergedIntoId: string | null;
  publicEmail: string | null;
  orcid: string | null;
  scholarUrl: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  translations: ScientistTranslation[];
  fields: ScientistTaxonomyItem[];
};

export type ScientistTaxonomy = {
  organizations: ScientistOrganization[];
  fields: ScientistTaxonomyItem[];
};

export type PublicScientistCard = {
  id: string;
  avatarUrl: string | null;
  organization: ScientistOrganization | null;
  fields: ScientistTaxonomyItem[];
  translation: ScientistTranslation;
};

export type PublicScientistDetail = PublicScientistCard & {
  publicEmail: string | null;
  orcid: string | null;
  scholarUrl: string | null;
  alternateTranslations: ScientistTranslation[];
  links: ScientistLink[];
  collaboration: Collaboration;
};
