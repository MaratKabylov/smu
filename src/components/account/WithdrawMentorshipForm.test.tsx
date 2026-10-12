// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ withdraw: vi.fn() }));
vi.mock("@/server/actions/account-records.actions", () => ({ withdrawAccountMentorship: mocks.withdraw }));
import { WithdrawMentorshipForm } from "./WithdrawMentorshipForm";
let container: HTMLDivElement, root: Root;
const id = "00000000-0000-4000-a000-000000000001";
beforeEach(() => {
  vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("requires confirmation and passes no identity or email in the form", async () => {
  mocks.withdraw.mockResolvedValue({ message: "saved" });
  await act(async () => root.render(<WithdrawMentorshipForm locale="kk" id={id} />));
  const form = container.querySelector("form")!; expect(form.checkValidity()).toBe(false);
  container.querySelector<HTMLInputElement>("input")!.checked = true;
  await act(async () => form.requestSubmit());
  expect(mocks.withdraw).toHaveBeenCalledWith("kk", id, {}, expect.any(FormData));
  expect([...mocks.withdraw.mock.calls[0][3].entries()]).toEqual([["confirm", "yes"]]);
  expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  expect(container.querySelector('[role="status"]')).not.toBeNull();
});
it("blocks concurrent submission and enables retry after failure", async () => {
  let finish!: (value: { message: "failed" }) => void;
  mocks.withdraw.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<WithdrawMentorshipForm locale="en" id={id} />));
  container.querySelector<HTMLInputElement>("input")!.checked = true;
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  await act(async () => finish({ message: "failed" }));
  expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unable to withdraw");
});
