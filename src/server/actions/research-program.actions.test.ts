import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/services/public-form-protection.service", () => ({ protectPublicForm: vi.fn(), PublicFormProtectionError: class extends Error {} }));
const mocks = vi.hoisted(() => ({ access: vi.fn(), assign: vi.fn(), decide: vi.fn(), localized: vi.fn(), private: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.private }));
vi.mock("@/lib/i18n/revalidation", () => ({ revalidateLocalizedPath: mocks.localized }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error("redirect:" + path); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/research-program.service", () => ({ ResearchProgramService: class { assignMentor = mocks.assign; updateApplication = mocks.decide; }, ResearchProgramServiceError: class extends Error {}, PublicResearchProgramService: class {} }));
import { assignResearchProgramMentor, updateResearchProgramApplication } from "./research-program.actions";
const id = "00000000-0000-4000-a000-000000000001";
const program = "00000000-0000-4000-a000-000000000002";
const mentor = "00000000-0000-4000-a000-000000000003";
const access = { userId: "current" };
const base = "/admin/programs/research-program";
function form(patch: Record<string, string> = {}) { const f = new FormData(); for (const [key, value] of Object.entries({ mentorId: mentor, version: "2", returnTo: "queue", actor: "forged", ...patch })) f.set(key, value); return f; }
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access }); });
it("assigns using current access and a validated version and refreshes only private routes", async () => {
  await expect(assignResearchProgramMentor(id, program, form())).rejects.toThrow("redirect:" + base + "/applications?application_saved=1");
  expect(mocks.assign).toHaveBeenCalledExactlyOnceWith(access, id, mentor, 2);
  for (const locale of ["ru", "kk", "en"]) {
    expect(mocks.private).toHaveBeenCalledWith(`/${locale}/account/research-program`, "layout");
    expect(mocks.private).toHaveBeenCalledWith(`/${locale}/account/applications`, "layout");
  }
  expect(mocks.localized).not.toHaveBeenCalled();
});
it("permits deliberate unassignment and returns to the program editor", async () => {
  await expect(assignResearchProgramMentor(id, program, form({ mentorId: "", returnTo: "program" }))).rejects.toThrow(`redirect:${base}/${program}?application_saved=1#applications`);
  expect(mocks.assign).toHaveBeenCalledWith(access, id, null, 2);
});
it("rejects invalid IDs, absent versions and invalid mentors without calling a mutation", async () => {
  await expect(assignResearchProgramMentor("bad", program, form())).rejects.toThrow("validation");
  const invalid: Record<string, string>[] = [{ version: "0" }, { version: "1.5" }, { version: "" }, { mentorId: "bad" }];
  for (const patch of invalid) await expect(assignResearchProgramMentor(id, program, form(patch))).rejects.toThrow("validation");
  expect(mocks.assign).not.toHaveBeenCalled(); expect(mocks.private).not.toHaveBeenCalled();
});
it("redirects unauthenticated users and hides internal errors without invalidating", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); await expect(assignResearchProgramMentor(id, program, form())).rejects.toThrow("redirect:/admin/login");
  mocks.assign.mockRejectedValueOnce(new Error("stale_version secret@email.org")); await expect(assignResearchProgramMentor(id, program, form())).rejects.toThrow("?error=stale_version");
  mocks.assign.mockRejectedValueOnce(new Error("secret@email.org")); await expect(assignResearchProgramMentor(id, program, form())).rejects.toThrow("?error=action_failed");
  expect(mocks.private).not.toHaveBeenCalled();
});
it("refreshes account lists after a decision that changes participation", async () => {
  await expect(updateResearchProgramApplication(id, program, form({ status: "accepted", note: "private note" }))).rejects.toThrow("application_saved=1");
  expect(mocks.decide).toHaveBeenCalledExactlyOnceWith(access, id, "accepted", "private note");
  expect(mocks.private).toHaveBeenCalledWith("/ru/account/research-program", "layout");
});
