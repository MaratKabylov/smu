import { describe, expect, it } from "vitest";
import { articleScheduleFormSchema, articleScheduleInputSchema } from "@/lib/validation/article";
import { scheduleInputValue } from "./scheduling";

describe("editorial schedule timezone and validation", () => {
  it("interprets local calendar input in Kazakhstan time and handles UTC day boundaries", () => {
    expect(articleScheduleFormSchema.parse("2026-10-07T00:15")).toBe("2026-10-06T19:15:00.000Z");
    expect(scheduleInputValue("2026-10-06T19:15:00Z")).toBe("2026-10-07T00:15");
    expect(scheduleInputValue("2026-10-06T19:00:00Z")).toBe("2026-10-07T00:00");
  });
  it.each(["", "2026-02-30T12:00", "2026-10-07T24:00", "2026-10-07T12:00Z", "2026-10-07", "2026-10-07T12:00:00", "infinity"])("rejects an invalid calendar value: %s", value => {
    expect(articleScheduleFormSchema.safeParse(value).success).toBe(false);
  });
  it("normalizes absolute optimistic tokens and permits explicit cancellation", () => {
    expect(articleScheduleInputSchema.parse({ expectedVersion: 2, scheduledAt: null, expectedScheduledAt: "2026-10-07T12:00:00+05:00" }))
      .toEqual({ expectedVersion: 2, scheduledAt: null, expectedScheduledAt: "2026-10-07T07:00:00.000Z" });
    for (const patch of [{ expectedVersion: 0 }, { expectedVersion: undefined }, { expectedScheduledAt: "2026-10-07T12:00:00" }]) {
      expect(articleScheduleInputSchema.safeParse({ expectedVersion: 2, scheduledAt: null, expectedScheduledAt: null, ...patch }).success).toBe(false);
    }
  });
});
