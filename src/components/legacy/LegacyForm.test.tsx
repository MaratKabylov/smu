// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), consent: vi.fn() }));
vi.mock("@/server/actions/scientific-legacy.actions", () => ({ saveScientificLegacy: mocks.save, setScientificLegacyConsent: mocks.consent }));
import { LegacyConsentForm, LegacyForm } from "./LegacyForm";
import type { LegacyOwnerItem } from "@/lib/validation/scientific-legacy";
const record: LegacyOwnerItem = { id: "00000000-0000-4000-a000-000000000001", version: 1, kind: "archive", status: "published", translations: ["ru", "kk"].map(locale => ({ locale: locale as "ru" | "kk", title: "Archive", description: "A scientific research archive description." })), sourceText: "SECRET", sourceUrl: "", sourceConsent: false, consentAt: null };
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("requires separate unchecked consent for the exact saved version and blocks pending submission", async () => {
  let finish!: (value: { message: "saved" }) => void; mocks.consent.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<LegacyConsentForm locale="ru" record={record} />));
  const form = container.querySelector("form")!; const input = container.querySelector<HTMLInputElement>("input")!; expect(input.checked).toBe(false); expect(form.checkValidity()).toBe(false); input.checked = true;
  await act(async () => form.requestSubmit()); expect(mocks.consent).toHaveBeenCalledWith("ru", record.id, 1, true, {}, expect.any(FormData));
  expect([...mocks.consent.mock.calls[0][5].entries()]).toEqual([["confirm", "yes"]]); expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  await act(async () => finish({ message: "saved" })); expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
});
it("allows revocation without rechecking permission and displays safe retry states", async () => {
  mocks.consent.mockResolvedValue({ message: "failed" });
  await act(async () => root.render(<LegacyConsentForm locale="en" record={{ ...record, sourceConsent: true }} />));
  expect(container.querySelector("input")).toBeNull(); await act(async () => container.querySelector("form")!.requestSubmit());
  expect(mocks.consent).toHaveBeenCalledWith("en", record.id, 1, false, {}, expect.any(FormData)); expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false); expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
it("does not show a grant button for unpublished or empty source records", async () => {
  for (const item of [{ ...record, status: "draft" as const }, { ...record, sourceText: "", sourceUrl: "" }]) {
    await act(async () => root.render(<LegacyConsentForm key={item.status + item.sourceText} locale="kk" record={item} />)); expect(container.querySelector("form")).toBeNull();
  }
});
it("keeps source fields separate from public descriptions and requires rights on every save", async () => {
  mocks.save.mockResolvedValue({ message: "saved", id: record.id }); await act(async () => root.render(<LegacyForm locale="en" record={record} />));
  const form = container.querySelector("form")!; expect(form.checkValidity()).toBe(false); expect(container.querySelector('[name="confirm"]')).toBeNull();
  container.querySelector<HTMLInputElement>('[name="rightsConfirmed"]')!.checked = true; await act(async () => form.requestSubmit());
  expect(mocks.save).toHaveBeenCalledWith("en", record.id, 1, {}, expect.any(FormData)); expect(container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
});
