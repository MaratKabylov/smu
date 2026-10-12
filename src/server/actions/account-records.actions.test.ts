import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claim: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/server/services/account-records.service", () => ({ AccountRecordsService: class { claimApplications = mocks.claim; }, AccountRecordsError: class extends Error { constructor(public code: string) { super(code); } } }));
import { AccountRecordsError } from "@/server/services/account-records.service";
import { claimAccountApplications } from "./account-records.actions";
beforeEach(() => { vi.clearAllMocks(); mocks.claim.mockResolvedValue(2); });
it.each(["ru", "kk", "en"] as const)("claims in %s and refreshes only its private list", async locale => {
  expect(await claimAccountApplications(locale, {})).toEqual({ message: "claimed", count: 2 });
  expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith(`/${locale}/account/applications`); expect(mocks.claim).toHaveBeenCalledExactlyOnceWith();
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
