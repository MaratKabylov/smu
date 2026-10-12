// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claim: vi.fn() }));
vi.mock("@/server/actions/account-records.actions", () => ({ claimAccountApplications: mocks.claim }));
import { ClaimApplicationsForm } from "./ClaimApplicationsForm";
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container); mocks.claim.mockResolvedValue({ message: "claimed", count: 0 });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("sends no email or owner identifier and allows another idempotent search", async () => {
  await act(async () => root.render(<ClaimApplicationsForm locale="kk" />)); await act(async () => container.querySelector("form")!.requestSubmit());
  expect(mocks.claim).toHaveBeenCalledWith("kk", {}, expect.any(FormData)); expect(Array.from(mocks.claim.mock.calls[0][2].keys())).toEqual([]);
  expect(container.querySelector('[role="status"]')?.textContent).toContain(": 0"); expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false);
});
it("blocks duplicate clicks while pending and announces failures for retry", async () => {
  let finish!: (value: { message: "failed" }) => void; mocks.claim.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<ClaimApplicationsForm locale="en" />)); await act(async () => container.querySelector("form")!.requestSubmit());
  expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true); expect(container.textContent).toContain("Searching");
  await act(async () => finish({ message: "failed" })); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unable to link"); expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false);
});
