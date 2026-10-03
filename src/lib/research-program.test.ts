import { describe, expect, it } from "vitest";
import { canChangeApplicationStatus, canChangeResearchProgramStatus, programApplicationsOpen, programLocalDate } from "./research-program";
describe("research program intake dates", () => {
  const program = { status: "published" as const, applicationsOpenOn: "2026-10-03", applicationDeadline: "2026-10-05" };
  it("includes the whole deadline day in Aktobe, regardless of the host timezone", () => {
    expect(programLocalDate(new Date("2026-10-02T19:00:00Z"))).toBe("2026-10-03");
    expect(programApplicationsOpen(program, new Date("2026-10-02T18:59:59Z"))).toBe(false);
    expect(programApplicationsOpen(program, new Date("2026-10-02T19:00:00Z"))).toBe(true);
    expect(programApplicationsOpen(program, new Date("2026-10-05T18:59:59Z"))).toBe(true);
    expect(programApplicationsOpen(program, new Date("2026-10-05T19:00:00Z"))).toBe(false);
    expect(programApplicationsOpen({ ...program, status: "draft" }, new Date("2026-10-03T12:00:00Z"))).toBe(false);
  });
  it("requires review before selection and keeps terminal application states terminal", () => {
    expect(canChangeApplicationStatus("new", "accepted")).toBe(false);
    expect(canChangeApplicationStatus("new", "in_review")).toBe(true);
    expect(canChangeApplicationStatus("in_review", "accepted")).toBe(true);
    expect(canChangeApplicationStatus("accepted", "completed")).toBe(true);
    expect(canChangeApplicationStatus("completed", "accepted")).toBe(false);
    expect(canChangeApplicationStatus("rejected", "in_review")).toBe(false);
    expect(canChangeResearchProgramStatus("archived", "published")).toBe(false);
    expect(canChangeResearchProgramStatus("archived", "draft")).toBe(true);
  });
});
