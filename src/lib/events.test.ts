import { describe, expect, it } from "vitest";
import { canChangeEventStatus, eventLocalInput, eventRegistrationOpen } from "./events";

describe("event scheduling", () => {
  it("uses Aktobe time across UTC day and year boundaries", () => {
    expect(eventLocalInput("2026-12-31T21:30:00Z")).toBe("2027-01-01T02:30");
    expect(eventLocalInput(null)).toBe("");
  });
  it("closes registration at the start, after a deadline and on cancellation", () => {
    const event = { status: "published" as const, startsAt: "2026-12-10T05:00:00Z", registrationUrl: "https://example.kz", registrationDeadline: "2026-12-09T05:00:00Z" };
    expect(eventRegistrationOpen(event, new Date("2026-12-09T05:00:00Z"))).toBe(true);
    expect(eventRegistrationOpen(event, new Date("2026-12-09T05:00:01Z"))).toBe(false);
    expect(eventRegistrationOpen({ ...event, registrationDeadline: null }, new Date(event.startsAt))).toBe(false);
    expect(eventRegistrationOpen({ ...event, status: "cancelled" }, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(eventRegistrationOpen({ ...event, status: "draft" }, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(eventRegistrationOpen({ ...event, registrationUrl: null }, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
  it("allows cancelling only a published event and restoring archives to draft", () => {
    expect(canChangeEventStatus("draft", "cancelled")).toBe(false);
    expect(canChangeEventStatus("published", "cancelled")).toBe(true);
    expect(canChangeEventStatus("cancelled", "published")).toBe(true);
    expect(canChangeEventStatus("archived", "published")).toBe(false);
    expect(canChangeEventStatus("archived", "draft")).toBe(true);
  });
});
