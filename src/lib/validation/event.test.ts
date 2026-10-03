import { describe, expect, it } from "vitest";
import { eventInputSchema, publicEventFiltersSchema } from "./event";

const translation = { title: "Science conference", slug: "science-conference", summary: "A conference for regional researchers.", description: "Presentations, discussion and workshops for the region's scientific community.", organizer: "Science council", location: "Aktobe, University hall" };
const input = { kind: "conference", format: "offline", startsAt: "2026-12-10T10:00", endsAt: "2026-12-10T18:00", registrationDeadline: "", registrationUrl: "", externalUrl: "", coverMediaId: "", ru: translation, kk: translation };

describe("event validation", () => {
  it("converts regional form time to UTC", () => {
    const parsed = eventInputSchema.parse(input);
    expect(parsed.startsAt).toBe("2026-12-10T05:00:00.000Z");
    expect(parsed.endsAt).toBe("2026-12-10T13:00:00.000Z");
    expect(parsed.registrationDeadline).toBeNull();
  });
  it("rejects invalid dates, reversed times and an equal end", () => {
    for (const startsAt of ["2026-02-30T10:00", "2026-12-10T25:00", "2026-12-10", "2026-12-10T10:00Z"])
      expect(eventInputSchema.safeParse({ ...input, startsAt }).success).toBe(false);
    for (const endsAt of ["2026-12-09T10:00", input.startsAt])
      expect(eventInputSchema.safeParse({ ...input, endsAt }).success).toBe(false);
  });
  it("requires both translations and bilingual offline locations", () => {
    expect(eventInputSchema.safeParse({ ...input, kk: undefined }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...input, kk: { ...translation, location: "" } }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...input, format: "online", externalUrl: "https://example.kz", ru: { ...translation, location: "" }, kk: { ...translation, location: "" } }).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...input, format: "hybrid", externalUrl: "" }).success).toBe(false);
  });
  it("requires a registration URL for deadlines and rejects unsafe URLs", () => {
    expect(eventInputSchema.safeParse({ ...input, registrationDeadline: "2026-12-09T10:00" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...input, registrationUrl: "https://example.kz", registrationDeadline: "2026-12-11T10:00" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...input, externalUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...input, registrationUrl: "ftp://example.kz" }).success).toBe(false);
  });
  it("validates filters and defaults to upcoming events", () => {
    expect(publicEventFiltersSchema.parse({}).period).toBe("upcoming");
    expect(publicEventFiltersSchema.safeParse({ period: "invalid" }).success).toBe(false);
  });
});
