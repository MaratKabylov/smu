// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ submit: vi.fn(), update: vi.fn() }));
vi.mock("@/server/actions/support-request.actions", () => ({ submitSupportRequest: m.submit, updateSupportRequest: m.update }));
import { SupportForm, SupportManageForm } from "./SupportForm";
import type { SupportRecord } from "@/lib/validation/support-request";
const record: SupportRecord = { id: "00000000-0000-4000-a000-000000000001", kind: "it_request", locale: "ru", title: "Request", status: "new", createdAt: "2026-10-17", updatedAt: "2026-10-17", version: 2, priority: "normal", assignedTo: null, managerNote: "Private" };
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("requires unchecked consent and blocks duplicate requests while pending and after success", async () => {
  let finish!: (value: { message: "saved" }) => void; m.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<SupportForm locale="kk" kind="it_request" />));
  const form = container.querySelector("form")!;
  const consent = container.querySelector<HTMLInputElement>('[name="consent"]')!; expect(consent.checked).toBe(false); expect(form.checkValidity()).toBe(false);
  for (const name of ["contactName", "title", "description", "currentProcess", "desiredSolution", "dataDescription"]) container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!.value = "Scientific research details for this request";
  container.querySelector<HTMLInputElement>('[name="email"]')!.value = "owner@example.org"; consent.checked = true;
  await act(async () => form.requestSubmit()); expect(m.submit).toHaveBeenCalledWith("kk", "it_request", {}, expect.any(FormData));
  expect(container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
  await act(async () => finish({ message: "saved" })); expect(container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
});
it("shows only allowed workflow choices and locks a stale manager decision", async () => {
  m.update.mockResolvedValue({ message: "stale" }); await act(async () => root.render(<SupportManageForm record={record} assignees={[]} />));
  expect([...container.querySelectorAll('[name="status"] option')].map(option => option.getAttribute("value"))).toEqual(["new", "in_review", "rejected"]);
  await act(async () => container.querySelector("form")!.requestSubmit()); expect(m.update).toHaveBeenCalledWith("ru", record.id, 2, {}, expect.any(FormData));
  expect(container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true); expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
it("retains editable fields and a safe error after a failed submission", async () => {
  m.submit.mockResolvedValue({ message: "failed" }); await act(async () => root.render(<SupportForm locale="en" kind="publication_support" />));
  const form = container.querySelector("form")!;
  // Dispatch directly to exercise a server failure independent of native validation.
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(false); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
  expect(container.querySelector('[name="journal"]')).not.toBeNull(); expect(container.querySelector('[name="currentProcess"]')).toBeNull();
});
