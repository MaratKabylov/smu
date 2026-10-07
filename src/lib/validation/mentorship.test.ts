import { describe, expect, it } from "vitest";
import { canChangeApplicationStatus } from "../mentorship";
import { mentorshipApplicationSchema, mentorshipInputSchema } from "./mentorship";
const uuid = "00000000-0000-4000-a000-000000000001";
const translation = { title: "Scientific mentorship", slug: "mentorship", summary: "Mentorship for young scientists in the region.", description: "Develop research skills with an experienced scientist through regular individual meetings." };
const offer = { scientistId: uuid, fieldId: uuid, format: "online", capacity: "3", ru: translation, kk: translation };
const application = { offerId: uuid, locale: "ru", fullName: "Young Scientist", email: " Applicant@Example.kz ", motivation: "I would like to develop a research project and learn to publish my scientific results.", consent: true, website: "" };
describe("mentorship validation", () => {
  it("requires complete bilingual offers and a bounded integer capacity", () => {
    expect(mentorshipInputSchema.parse(offer).capacity).toBe(3);
    for (const capacity of ["", "0", "51", "2.5", "NaN"]) expect(mentorshipInputSchema.safeParse({ ...offer, capacity }).success).toBe(false);
    expect(mentorshipInputSchema.safeParse({ ...offer, kk: undefined }).success).toBe(false);
    expect(mentorshipInputSchema.safeParse({ ...offer, ru: { ...translation, slug: "../bad" } }).success).toBe(false);
  });
  it("normalizes email before duplicate and rate checks", () => {
    expect(mentorshipApplicationSchema.parse(application).email).toBe("applicant@example.kz");
  });
  it("requires consent, valid contacts and substantive motivation, rejecting the honeypot", () => {
    for (const override of [{ consent: false }, { email: "invalid" }, { fullName: " " }, { motivation: "Too short" }, { motivation: "a".repeat(5001) }, { website: "https://spam.example" }, { locale: "de" }]) {
      expect(mentorshipApplicationSchema.safeParse({ ...application, ...override }).success).toBe(false);
    }
  });
  it("requires review before acceptance and keeps final decisions final", () => {
    expect(canChangeApplicationStatus("new", "accepted")).toBe(false);
    expect(canChangeApplicationStatus("in_review", "accepted")).toBe(true);
    expect(canChangeApplicationStatus("accepted", "completed")).toBe(true);
    expect(canChangeApplicationStatus("completed", "accepted")).toBe(false);
    expect(canChangeApplicationStatus("rejected", "in_review")).toBe(false);
  });
});
