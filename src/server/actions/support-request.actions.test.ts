import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ submit: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
vi.mock("@/server/services/support-request.service", () => ({ SupportRequestService: class { submit = m.submit; update = m.update; } }));
import { submitSupportRequest, updateSupportRequest } from "./support-request.actions";
const id = "00000000-0000-4000-a000-000000000001";
const form = () => {
  const f = new FormData(); for (const [key, value] of Object.entries({ title: "Research system", description: "A description of the scientific IT request.", contactName: "A Scientist", email: "own@example.org", organization: "", currentProcess: "Manual", desiredSolution: "Automation", dataDescription: "Research data", consent: "yes", owner_id: "FORGED", filesPath: "FORGED" })) f.set(key, value);
  return f;
};
beforeEach(() => { vi.clearAllMocks(); m.submit.mockResolvedValue(id); m.update.mockResolvedValue(undefined); });
it("requires explicit consent and ignores forged ownership and storage metadata", async () => {
  const f = form(); f.delete("consent"); expect(await submitSupportRequest("ru", "it_request", {}, f)).toEqual({ message: "invalid" }); expect(m.submit).not.toHaveBeenCalled();
  expect(await submitSupportRequest("kk", "it_request", {}, form())).toEqual({ message: "saved", id });
  expect(m.submit.mock.calls[0][0]).not.toHaveProperty("owner_id"); expect(m.submit.mock.calls[0][0]).not.toHaveProperty("filesPath");
});
it("passes inspected file candidates to the service and preserves empty file rejection", async () => {
  const f = form(); f.append("files", new File([], "empty.pdf", { type: "application/pdf" })); await submitSupportRequest("ru", "it_request", {}, f); expect(m.submit.mock.calls[0][1][0].name).toBe("empty.pdf");
  f.set("files", "forged"); expect(await submitSupportRequest("ru", "it_request", {}, f)).toEqual({ message: "invalid" });
});
it("refreshes only the protected queue and owner routes in every language", async () => {
  await submitSupportRequest("en", "it_request", {}, form());
  for (const kind of ["research_proposal", "it_request", "publication_support"]) expect(m.refresh).toHaveBeenCalledWith(`/admin/support/${kind}`);
  for (const locale of ["ru", "kk", "en"]) expect(m.refresh).toHaveBeenCalledWith(`/${locale}/account/support`);
});
it("maps errors safely without exposing contact details or invalidating failures", async () => {
  for (const [message, expected] of [["rate_limited", "rate"], ["invalid_file", "file"], ["session", "session"], ["SECRET own@example.org", "failed"]]) {
    m.submit.mockRejectedValueOnce({ message }); expect(await submitSupportRequest("ru", "it_request", {}, form())).toEqual({ message: expected });
  }
  expect(m.refresh).not.toHaveBeenCalled();
});
it("validates version and manager fields, handles stale decisions and sends no actor", async () => {
  const f = new FormData(); for (const [key, value] of Object.entries({ status: "in_review", priority: "high", assignedTo: "", note: "Staff note", actor: "FORGED" })) f.set(key, value);
  expect(await updateSupportRequest("ru", id, 0, {}, f)).toEqual({ message: "invalid" }); expect(m.update).not.toHaveBeenCalled();
  await updateSupportRequest("ru", id, 3, {}, f); expect(m.update).toHaveBeenCalledWith({ id, version: 3, status: "in_review", priority: "high", assignedTo: null, note: "Staff note" });
  m.update.mockRejectedValueOnce({ message: "stale_version" }); expect(await updateSupportRequest("ru", id, 3, {}, f)).toEqual({ message: "stale" });
});
