import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), consent: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/server/services/scientific-legacy.service", () => ({ ScientificLegacyService: class { save = mocks.save; consent = mocks.consent; }, ScientificLegacyError: class extends Error { constructor(public code: string) { super(code); } } }));
import { ScientificLegacyError } from "@/server/services/scientific-legacy.service";
import { saveScientificLegacy, setScientificLegacyConsent } from "./scientific-legacy.actions";
const id = "00000000-0000-4000-a000-000000000001";
function form() {
  const f = new FormData(); f.set("kind", "archive"); f.set("status", "published"); f.set("sourceText", "SECRET"); f.set("sourceUrl", ""); f.set("rightsConfirmed", "yes");
  for (const locale of ["ru", "kk"]) { f.set(`${locale}.title`, "Archive"); f.set(`${locale}.description`, "Scientific research archive description."); }
  f.set("owner_id", "FORGED"); f.set("consent", "true"); return f;
}
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue(id); mocks.consent.mockResolvedValue(undefined); });
it("does not accept implicit permission and does not forward forged identity fields", async () => {
  expect(await setScientificLegacyConsent("ru", id, 1, true, {}, new FormData())).toEqual({ message: "invalid" }); expect(mocks.consent).not.toHaveBeenCalled();
  const f = form(); f.delete("rightsConfirmed"); expect(await saveScientificLegacy("ru", null, null, {}, f)).toEqual({ message: "invalid" }); expect(mocks.save).not.toHaveBeenCalled();
  expect(await saveScientificLegacy("ru", null, null, {}, form())).toEqual({ message: "saved", id });
  expect(mocks.save.mock.calls[0][0]).not.toHaveProperty("owner_id"); expect(mocks.save.mock.calls[0][0]).not.toHaveProperty("consent");
});
it("refreshes every account and public language after consent and revocation", async () => {
  const f = new FormData(); f.set("confirm", "yes");
  expect(await setScientificLegacyConsent("kk", id, 3, true, {}, f)).toEqual({ message: "saved", id });
  expect(mocks.consent).toHaveBeenCalledWith(id, 3, true);
  for (const locale of ["ru", "kk", "en"]) { expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/account/legacy`, "layout"); expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/mentorship/legacy`, "layout"); }
  expect(await setScientificLegacyConsent("en", id, 4, false, {}, new FormData())).toEqual({ message: "saved", id });
});
it("localizes safe error states without leaking database details or invalidating failed writes", async () => {
  mocks.save.mockRejectedValueOnce(new Error("SECRET private@example.org")); expect(await saveScientificLegacy("ru", null, null, {}, form())).toEqual({ message: "failed" });
  mocks.consent.mockRejectedValueOnce({ message: "stale_version" }); expect(await setScientificLegacyConsent("ru", id, 1, false, {}, new FormData())).toEqual({ message: "stale" });
  mocks.consent.mockRejectedValueOnce(new ScientificLegacyError("session")); expect(await setScientificLegacyConsent("en", id, 1, false, {}, new FormData())).toEqual({ message: "session" });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("rejects unknown locales before mutations", async () => {
  // @ts-expect-error invalid runtime locale
  expect(await saveScientificLegacy("de", null, null, {}, form())).toEqual({ message: "invalid" });
  // @ts-expect-error invalid runtime locale
  expect(await setScientificLegacyConsent("de", id, 1, false, {}, new FormData())).toEqual({ message: "invalid" });
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.consent).not.toHaveBeenCalled();
});
