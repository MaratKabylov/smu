// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/server/actions/account.actions", () => ({ submitAccountForm: mocks.submit }));
import { AccountForm } from "./AccountForm";
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container); mocks.submit.mockResolvedValue({ message: "sent" });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("collects registration name, email and matching new passwords with bounded fields", async () => {
  await act(async () => root.render(<AccountForm locale="kk" mode="register" />));
  expect(container.textContent).toContain("Аты-жөні"); expect(container.querySelector<HTMLInputElement>('[name="displayName"]')?.maxLength).toBe(120); expect(container.querySelectorAll('[autocomplete="new-password"]')).toHaveLength(2); expect(container.querySelector<HTMLInputElement>('[name="password"]')?.minLength).toBe(8);
});
it("sends recovery in the selected locale and displays a generic notice", async () => {
  await act(async () => root.render(<AccountForm locale="en" mode="recover" />)); const email = container.querySelector<HTMLInputElement>('[name="email"]')!; email.value = "own@example.org";
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(mocks.submit).toHaveBeenCalledWith("en", "recover", {}, expect.any(FormData)); expect(mocks.submit.mock.calls[0][3].get("email")).toBe("own@example.org"); expect(container.querySelector('[role="status"]')?.textContent).toContain("If this request is available"); expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
});
it("keeps a failed form available for retry without exposing provider details", async () => {
  mocks.submit.mockResolvedValue({ message: "failed" }); await act(async () => root.render(<AccountForm locale="ru" mode="recover" />)); container.querySelector<HTMLInputElement>('[name="email"]')!.value = "own@example.org";
  await act(async () => container.querySelector("form")!.requestSubmit()); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Попробуйте позже"); expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
});
it("disables duplicate submissions while a request is pending", async () => {
  let finish!: (value: { message: "sent" }) => void; mocks.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<AccountForm locale="ru" mode="recover" />)); container.querySelector<HTMLInputElement>('[name="email"]')!.value = "own@example.org";
  await act(async () => container.querySelector("form")!.requestSubmit()); expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true); expect(container.textContent).toContain("Подождите");
  await act(async () => finish({ message: "sent" })); expect(container.querySelector('[role="status"]')).not.toBeNull(); expect(mocks.submit).toHaveBeenCalledOnce();
});
