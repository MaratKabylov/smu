import { describe, expect, it } from "vitest";
import { researchProgramApplicationSchema, researchProgramInputSchema } from "./research-program";

const translation = { title: "Research skills", slug: "research-skills", summary: "A program for young scientists in the region.", description: "Develop research skills and prepare a scientific project with an experienced coordinator.", curriculum: "Research methods, data analysis and scientific writing.", eligibility: "Young researchers with a proposed research topic.", outcomes: "A research plan and a presentation of initial results." };
const input = { coordinatorId: "00000000-0000-4000-a000-000000000001", fieldId: "00000000-0000-4000-a000-000000000002", format: "online", capacity: 20,
  applicationsOpenOn: "2026-10-01", applicationDeadline: "2026-10-15", startsOn: "2026-11-01", endsOn: "2026-12-01", ru: translation, kk: translation };
describe("research program validation", () => {
  it("requires both complete language versions and bounds cohort size", () => {
    expect(researchProgramInputSchema.safeParse(input).success).toBe(true);
    for (const change of [{ kk: undefined }, { kk: { ...translation, curriculum: "" } }, { ru: { ...translation, eligibility: "" } }, { capacity: 0 }, { capacity: 501 }, { capacity: 1.5 }]) {
      expect(researchProgramInputSchema.safeParse({ ...input, ...change }).success).toBe(false);
    }
  });
  it("rejects impossible dates and out-of-order intake and program dates", () => {
    for (const change of [{ applicationsOpenOn: "2026-10-16" }, { applicationDeadline: "2026-11-02" }, { endsOn: "2026-10-31" }, { startsOn: "2026-02-30" }]) {
      expect(researchProgramInputSchema.safeParse({ ...input, ...change }).success).toBe(false);
    }
    expect(researchProgramInputSchema.safeParse({ ...input, startsOn: input.applicationDeadline, endsOn: input.applicationDeadline }).success).toBe(true);
  });
  it("normalizes email, requires explicit consent and rejects the honeypot", () => {
    const application = { programId: input.coordinatorId, locale: "kk", fullName: "Young Scientist", email: " APPLICANT@example.kz ", motivation: "I want to develop my research skills and prepare a scientific publication.", consent: true, website: "" };
    expect(researchProgramApplicationSchema.parse(application).email).toBe("applicant@example.kz");
    for (const change of [{ consent: false }, { consent: undefined }, { website: "https://spam.example" }, { motivation: "Short" }]) {
      expect(researchProgramApplicationSchema.safeParse({ ...application, ...change }).success).toBe(false);
    }
  });
});
