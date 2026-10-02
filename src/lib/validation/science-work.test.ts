import { describe, expect, it } from "vitest";
import { publicScienceWorkFiltersSchema, scienceWorkInputSchema } from "./science-work";
const person = "f3576689-3d41-43f6-a17d-56bca5d9dc18";
const translation = { title: "Научная работа", slug: "regional-research", summary: "Исследование научного потенциала и технологий региона.", description: "Работа посвящена исследованию научного потенциала региона и развитию новых технологий.", results: "" };
const input = { stage: "active", organizationId: "", fieldId: person, coverMediaId: "", startDate: "2026-01-01", endDate: "2026-12-31", externalUrl: "https://example.kz/research", doi: "10.1234/example", leadScientistId: "", memberIds: [], ru: translation, kk: { ...translation, slug: "regional-research-kk" } };
describe("science work validation", () => {
  it("normalizes empty optional references", () => {
    expect(scienceWorkInputSchema.parse(input).organizationId).toBeNull();
  });
  it("requires complete content in both languages", () => {
    expect(scienceWorkInputSchema.safeParse({ ...input, kk: { ...input.kk, description: "" } }).success).toBe(false);
  });
  it("rejects impossible dates and reversed ranges", () => {
    expect(scienceWorkInputSchema.safeParse({ ...input, startDate: "2026-02-30" }).success).toBe(false);
    expect(scienceWorkInputSchema.safeParse({ ...input, endDate: "2025-12-31" }).success).toBe(false);
  });
  it("rejects duplicate members and a duplicated leader", () => {
    expect(scienceWorkInputSchema.safeParse({ ...input, memberIds: [person, person] }).success).toBe(false);
    expect(scienceWorkInputSchema.safeParse({ ...input, leadScientistId: person, memberIds: [person] }).success).toBe(false);
  });
  it.each(["javascript:alert(1)", "data:text/html,hello", "ftp://example.kz"])('rejects unsafe external URL %s', externalUrl => {
    expect(scienceWorkInputSchema.safeParse({ ...input, externalUrl }).success).toBe(false);
  });
  it("accepts a DOI and rejects a URL masquerading as a DOI", () => {
    expect(scienceWorkInputSchema.safeParse(input).success).toBe(true);
    expect(scienceWorkInputSchema.safeParse({ ...input, doi: "https://doi.org/10.1234/example" }).success).toBe(false);
  });
  it("rejects invalid public filters", () => {
    expect(publicScienceWorkFiltersSchema.safeParse({ field: "../admin" }).success).toBe(false);
    expect(publicScienceWorkFiltersSchema.safeParse({ stage: "draft" }).success).toBe(false);
  });
});
