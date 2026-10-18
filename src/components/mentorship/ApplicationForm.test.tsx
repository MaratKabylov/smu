// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/server/actions/mentorship.actions", () => ({ submitMentorshipApplication: m.submit }));
vi.mock("@/server/actions/research-program.actions", () => ({ submitResearchProgramApplication: m.submit }));
import { ApplicationForm as Mentorship } from "./ApplicationForm";
import { ApplicationForm as Research } from "../research-program/ApplicationForm";
import { publicFormRateMessage } from "@/lib/i18n/public-form";
import { locales, type Locale } from "@/lib/i18n/locales";
let container: HTMLDivElement, root: Root;
const id = "00000000-0000-4000-a000-000000000001";
const element = (kind: string, locale: Locale) => kind === "mentorship" ? <Mentorship offerId={id} locale={locale} /> : <Research programId={id} locale={locale} />;
beforeEach(() => { vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container=document.createElement("div"); document.body.append(container); root=createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it.each(locales.flatMap(locale => ["mentorship","research"].map(kind => ({ locale,kind }))))("requires explicit consent and excludes the $locale/$kind honeypot from navigation", async ({ locale,kind }) => {
  await act(async () => root.render(element(kind,locale)));
  const consent=container.querySelector<HTMLInputElement>('[name="consent"]')!;
  expect(consent.checked).toBe(false); expect(consent.required).toBe(true); expect(consent.value).toBe("yes");
  const trap=container.querySelector<HTMLInputElement>('[name="website"]')!;
  expect(trap.value).toBe(""); expect(trap.tabIndex).toBe(-1); expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  if (locale === "en") expect(consent.parentElement!.textContent).toContain("I consent");
});
it.each(locales.flatMap(locale => ["mentorship","research"].map(kind => ({ locale,kind }))))("shows the common safe limit message and permits retry for $locale/$kind", async ({ locale,kind }) => {
  m.submit.mockResolvedValue({ code: "rate_limited" }); await act(async () => root.render(element(kind,locale)));
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit",{ bubbles:true,cancelable:true })));
  expect(container.querySelector('[role="alert"]')!.textContent).toBe(publicFormRateMessage[locale]);
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
});
