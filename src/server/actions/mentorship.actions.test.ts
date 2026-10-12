import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), decision: vi.fn(), change: vi.fn(), path: vi.fn(), tag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/mentorship.service", () => ({ MentorshipService: class { updateApplication = mocks.decision; changeRelation = mocks.change; }, PublicMentorshipService: class {}, MentorshipServiceError: class extends Error {} }));
import { changeMentorshipRelation, updateMentorshipApplication } from "./mentorship.actions";
const id = "00000000-0000-4000-a000-000000000001";
const offer = "00000000-0000-4000-a000-000000000002";
const access = { userId: id, permissions: new Set(["admin.access", "mentorship.manage"]), roles: new Set() };
const decisionForm = () => { const form = new FormData(); form.set("status", "accepted"); form.set("note", "Coordinator note"); form.set("kind", "consultant"); form.set("returnTo", "queue"); form.set("actor", "forged"); return form; };
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access }); });
it("passes the chosen kind with authenticated access and refreshes private and manager views", async () => {
  await expect(updateMentorshipApplication(id, offer, decisionForm())).rejects.toThrow("/applications?application_saved=1");
  expect(mocks.decision).toHaveBeenCalledExactlyOnceWith(access, id, "accepted", "Coordinator note", "consultant");
  for (const locale of ["ru", "kk", "en"]) expect(mocks.path).toHaveBeenCalledWith(`/${locale}/account/applications`, "layout");
  expect(mocks.path).toHaveBeenCalledWith("/admin/programs/mentorship", "layout");
});
it("validates IDs and relation states before mutation and uses fixed return routes", async () => {
  const form = new FormData(); form.set("relationStatus", "invented"); form.set("returnTo", "https://attacker.org");
  await expect(changeMentorshipRelation("invalid", form)).rejects.toThrow("error=validation");
  expect(mocks.access).not.toHaveBeenCalled();
  await expect(changeMentorshipRelation(id, form)).rejects.toThrow("error=validation");
  expect(mocks.change).not.toHaveBeenCalled();
  form.set("relationStatus", "paused");
  await expect(changeMentorshipRelation(id, form)).rejects.toThrow("/applications?application_saved=1&application=" + id);
  expect(mocks.change).toHaveBeenCalledWith(access, id, "paused");
});
it("denies missing sessions and reports DB permission failures without invalidating", async () => {
  const form = new FormData(); form.set("relationStatus", "cancelled");
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
  await expect(changeMentorshipRelation(id, form)).rejects.toThrow("/admin/login");
  expect(mocks.change).not.toHaveBeenCalled();
  mocks.change.mockRejectedValueOnce({ message: "forbidden" });
  await expect(changeMentorshipRelation(id, form)).rejects.toThrow("error=forbidden");
  expect(mocks.path).not.toHaveBeenCalled();
});
it("rejects invalid kinds and hides unexpected database errors", async () => {
  const form = decisionForm(); form.set("kind", "invented");
  await expect(updateMentorshipApplication(id, offer, form)).rejects.toThrow("error=validation");
  expect(mocks.decision).not.toHaveBeenCalled();
  mocks.decision.mockRejectedValueOnce({ message: "SECRET private@email.org" });
  await expect(updateMentorshipApplication(id, offer, decisionForm())).rejects.toThrow("error=action_failed");
  expect(mocks.path).not.toHaveBeenCalled();
});
