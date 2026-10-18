import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ protect: vi.fn(), mentorship: vi.fn(), research: vi.fn(), support: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh, revalidateTag: m.refresh }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: vi.fn() }));
vi.mock("@/server/services/public-form-protection.service", () => ({ protectPublicForm: m.protect, PublicFormProtectionError: class extends Error { constructor(public code: string) { super(code); } } }));
vi.mock("@/server/services/mentorship.service", () => ({ PublicMentorshipService: class { submit = m.mentorship; }, MentorshipService: class {}, MentorshipServiceError: class extends Error {} }));
vi.mock("@/server/services/research-program.service", () => ({ PublicResearchProgramService: class { submit = m.research; }, ResearchProgramService: class {}, ResearchProgramServiceError: class extends Error {} }));
vi.mock("@/server/services/support-request.service", () => ({ SupportRequestService: class { submit = m.support; } }));
import { PublicFormProtectionError } from "@/server/services/public-form-protection.service";
import { submitMentorshipApplication } from "./mentorship.actions";
import { submitResearchProgramApplication } from "./research-program.actions";
import { submitSupportRequest } from "./support-request.actions";
import { locales, type Locale } from "@/lib/i18n/locales";
import { supportKinds, supportFields } from "@/lib/validation/support-request";
const id = "00000000-0000-4000-a000-000000000001";
const cases = ["mentorship", "research", ...supportKinds] as const;
type Kind = typeof cases[number];
const form = (locale: Locale, kind: Kind) => {
  const f = new FormData();
  for (const [key,value] of Object.entries({ locale, offerId: id, programId: id, email: " OWNER@EXAMPLE.ORG ", fullName: "A Scientist", motivation: "I would like to develop research skills through this programme.", contactName: "A Scientist", title: "Scientific research request", description: "Research support for scientific development.", organization: "", website: "", consent: "yes" })) f.set(key,value);
  if (kind !== "mentorship" && kind !== "research") for (const field of supportFields[kind]) f.set(field,"Scientific research details");
  return f;
};
const submit = (locale: Locale, kind: Kind, f: FormData) => kind === "mentorship" ? submitMentorshipApplication({ code: "" },f) : kind === "research" ? submitResearchProgramApplication({ code: "" },f) : submitSupportRequest(locale,kind,{},f);
beforeEach(() => { vi.clearAllMocks(); m.protect.mockReset().mockResolvedValue(undefined); m.support.mockResolvedValue(id); });
it.each(locales.flatMap(locale => cases.map(kind => ({ locale, kind }))))("protects $locale/$kind before creating a record", async ({ locale, kind }) => {
  const f = form(locale,kind); await submit(locale,kind,f);
  expect(m.protect).toHaveBeenCalledExactlyOnceWith(f,"owner@example.org");
  const service = kind === "mentorship" ? m.mentorship : kind === "research" ? m.research : m.support;
  expect(service).toHaveBeenCalledOnce(); expect(m.protect.mock.invocationCallOrder[0]).toBeLessThan(service.mock.invocationCallOrder[0]);
});
it.each(cases)("never creates a %s record, uploads or invalidates after rate denial", async kind => {
  m.protect.mockRejectedValueOnce(new PublicFormProtectionError("rate_limited"));
  expect(await submit("ru",kind,form("ru",kind))).toEqual(kind === "mentorship" || kind === "research" ? { code: "rate_limited" } : { message: "rate" });
  for (const fn of [m.mentorship,m.research,m.support,m.refresh]) expect(fn).not.toHaveBeenCalled();
});
it.each(cases)("fails closed and hides protection setup/database errors for %s", async kind => {
  m.protect.mockRejectedValueOnce(new Error("SECRET network 192.0.2.1 email owner@example.org"));
  expect(await submit("ru",kind,form("ru",kind))).toEqual(kind === "mentorship" || kind === "research" ? { code: "action_failed" } : { message: "failed" });
  for (const fn of [m.mentorship,m.research,m.support,m.refresh]) expect(fn).not.toHaveBeenCalled();
});
it.each(cases)("validates explicit consent before limiting %s and maps common trap failures safely", async kind => {
  const f = form("kk",kind); f.delete("consent");
  const invalid = kind === "mentorship" || kind === "research" ? { code: "validation" } : { message: "invalid" };
  expect(await submit("kk",kind,f)).toEqual(invalid); expect(m.protect).not.toHaveBeenCalled();
  m.protect.mockRejectedValueOnce(new PublicFormProtectionError("invalid_input"));
  expect(await submit("kk",kind,form("kk",kind))).toEqual(invalid);
  for (const fn of [m.mentorship,m.research,m.support]) expect(fn).not.toHaveBeenCalled();
});
