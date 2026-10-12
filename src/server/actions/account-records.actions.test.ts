import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claim: vi.fn(), withdraw: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/server/services/account-records.service", () => ({ AccountRecordsService: class { claimApplications = mocks.claim; withdrawMentorship = mocks.withdraw; }, AccountRecordsError: class extends Error { constructor(public code: string) { super(code); } } }));
import { AccountRecordsError } from "@/server/services/account-records.service";
import { claimAccountApplications, withdrawAccountMentorship } from "./account-records.actions";
beforeEach(() => { vi.clearAllMocks(); mocks.claim.mockResolvedValue(2); });
it.each(["ru", "kk", "en"] as const)("claims in %s and refreshes only its private list", async locale => {
  expect(await claimAccountApplications(locale, {})).toEqual({ message: "claimed", count: 2 });
  expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith(`/${locale}/account/applications`); expect(mocks.claim).toHaveBeenCalledExactlyOnceWith();
});
const id = "00000000-0000-4000-a000-000000000001";
const confirmation = () => { const form = new FormData(); form.set("confirm", "yes"); form.set("actor", "another-user"); return form; };
it("requires explicit withdrawal confirmation and validates IDs before mutation", async () => {
  expect(await withdrawAccountMentorship("ru", id, {}, new FormData())).toEqual({ message: "failed" });
  expect(await withdrawAccountMentorship("ru", "invalid", {}, confirmation())).toEqual({ message: "failed" });
  // @ts-expect-error unsupported locale
  expect(await withdrawAccountMentorship("de", id, {}, confirmation())).toEqual({ message: "failed" });
  expect(mocks.withdraw).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("withdraws only by ID and refreshes all private language versions and the manager queue", async () => {
  expect(await withdrawAccountMentorship("kk", id, {}, confirmation())).toEqual({ message: "saved" });
  expect(mocks.withdraw).toHaveBeenCalledExactlyOnceWith(id);
  for (const locale of ["ru", "kk", "en"]) expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/account/applications`, "layout");
  expect(mocks.revalidate).toHaveBeenCalledWith("/admin/programs/mentorship", "layout");
});
it("reports withdrawal failures safely and never claims success on expired sessions", async () => {
  mocks.withdraw.mockRejectedValueOnce(new Error("not_found secret@email.org"));
  expect(await withdrawAccountMentorship("ru", id, {}, confirmation())).toEqual({ message: "failed" });
  mocks.withdraw.mockRejectedValueOnce(new AccountRecordsError("session"));
  expect(await withdrawAccountMentorship("en", id, {}, confirmation())).toEqual({ message: "session" });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("rejects invalid locales without a mutation", async () => {
  // @ts-expect-error unsupported runtime locale
  expect(await claimAccountApplications("de", {})).toEqual({ message: "failed" }); expect(mocks.claim).not.toHaveBeenCalled();
});
it("hides DB details and reports session expiration without claiming success", async () => {
  mocks.claim.mockRejectedValueOnce(new Error("private@email.org DB secret")); expect(await claimAccountApplications("ru", {})).toEqual({ message: "failed" });
  mocks.claim.mockRejectedValueOnce(new AccountRecordsError("session")); expect(await claimAccountApplications("kk", {})).toEqual({ message: "session" });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
