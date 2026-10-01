import { describe, expect, it } from "vitest";
import { publicScientistFiltersSchema, scientistInputSchema } from "./scientist";

const validInput = {
  organizationId: "",
  avatarMediaId: "",
  fieldIds: [],
  publicEmail: "scientist@example.kz",
  orcid: "0000-0002-1825-0097",
  scholarUrl: "https://scholar.google.com/example",
  ru: {
    fullName: "Алия Сериковна Ахметова",
    slug: "aliya-akhmetova",
    position: "Научный сотрудник",
    academicDegree: "PhD",
    shortBio: "Исследователь новых материалов и региональных технологий.",
    biography: "Алия занимается исследованиями новых материалов и развивает научные проекты региона.",
  },
  kk: {
    fullName: "Әлия Серікқызы Ахметова",
    slug: "aliya-akhmetova-kk",
    position: "Ғылыми қызметкер",
    academicDegree: "PhD",
    shortBio: "Жаңа материалдар мен өңірлік технологияларды зерттеуші.",
    biography: "Әлия жаңа материалдарды зерттеп, өңірдегі ғылыми жобаларды дамытуға үлес қосады.",
  },
} as const;

describe("scientist validation", () => {
  it("accepts a complete bilingual profile", () => {
    expect(scientistInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects malformed ORCID", () => {
    expect(scientistInputSchema.safeParse({ ...validInput, orcid: "123" }).success).toBe(false);
  });

  it("rejects duplicate scientific fields", () => {
    const id = "f3576689-3d41-43f6-a17d-56bca5d9dc18";
    expect(scientistInputSchema.safeParse({ ...validInput, fieldIds: [id, id] }).success).toBe(false);
  });

  it("rejects unsafe catalog filters", () => {
    expect(publicScientistFiltersSchema.safeParse({ locale: "ru", query: "", organization: "../admin", field: "" }).success).toBe(false);
  });
});
