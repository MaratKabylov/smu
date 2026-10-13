import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), get: vi.fn(), account: vi.fn(), participation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error("redirect:" + path); }, notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/server/services/account.service", () => ({ getAccountAccess: mocks.access }));
vi.mock("@/server/services/account-records.service", () => ({ AccountRecordsService: class { get = mocks.get; researchProgram = mocks.account; }, AccountRecordsError: class extends Error { constructor(public code: string) { super(code); } } }));
vi.mock("@/server/services/research-program.service", () => ({ ResearchProgramService: class { participation = mocks.participation; } }));
vi.mock("@/server/actions/research-program.actions", () => ({ updateResearchProgramApplication: vi.fn(), assignResearchProgramMentor: vi.fn(), changeResearchProgram: vi.fn(), saveResearchProgram: vi.fn() }));
import { ResearchProgramParticipation } from "./ResearchProgramParticipation";
import AccountDetailPage from "@/app/[locale]/account/[section]/[id]/page";
import { ResearchProgramApplicationCard } from "@/components/research-program/ResearchProgramAdmin";
import { researchProgramAccountCopy } from "@/lib/i18n/research-program-account";
import { accountResearchProgramSchema, type AccountResearchProgram } from "@/lib/validation/research-program-participation";
import { AccountRecordsError } from "@/server/services/account-records.service";
import type { AccessContext } from "@/types/domain/auth";
const id = "00000000-0000-4000-a000-000000000001";
const work = "00000000-0000-4000-a000-000000000002";
const output = "00000000-0000-4000-a000-000000000003";
const file = "00000000-0000-4000-a000-000000000004";
const data: AccountResearchProgram = {
  applicationStatus: "accepted",
  program: { title: "Research program", locale: "ru", status: "archived", applicationsOpenOn: "2026-09-01", applicationDeadline: "2026-10-01", startsOn: "2026-10-02", endsOn: "2026-12-01", curriculum: "<script>unsafe</script>" },
  participation: { status: "active", createdAt: "2026-10-01", baseline: false, mentorAssigned: true, mentor: { name: "Program mentor", slug: "mentor", locale: "ru" } },
  projects: [{ id: work, title: "My project", status: "published", locale: "ru", summary: "Project summary", outputs: [{ id: output, kind: "report", version: 2, versionLabel: "v2", title: "Research output", description: "Research findings", externalUrl: "https://example.org/report", license: "CC BY", files: [{ id: file, name: "report.pdf", mimeType: "application/pdf", size: 10 }] }] }],
};
const props = (locale = "ru", section = "research-program") => ({ params: Promise.resolve({ locale, section, id }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed" }); mocks.account.mockResolvedValue(data);
  mocks.get.mockResolvedValue({ record: { id, kind: "program_application", title: "Research Program", status: "accepted", locale: "ru", body: "My motivation", content: null, summary: null, relationship: "applicant" }, editor: null });
});
it.each(["ru", "kk", "en"] as const)("renders %s participant data, owned project links and versioned public downloads", async locale => {
  const html = renderToStaticMarkup(await AccountDetailPage(props(locale)));
  const copy = researchProgramAccountCopy[locale];
  expect(html).toContain(copy.title); expect(html).toContain(copy.intake); expect(html).toContain(copy.dates); expect(html).toContain(copy.curriculum);
  expect(html).toContain(copy.active); expect(html).toContain("Program mentor"); expect(html).toContain('href="/ru/scientists/mentor"');
  expect(html).toContain(`href="/${locale}/account/projects/${work}"`); expect(html).toContain(`/api/results/${output}/files/${file}?version=2`);
  expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>unsafe");
  expect(mocks.account).toHaveBeenCalledExactlyOnceWith(id, locale);
});
it("shows pending applications, absent mentors/projects/results and upgrade baselines without fabricated dates", () => {
  expect(renderToStaticMarkup(<ResearchProgramParticipation locale="ru" data={{ ...data, participation: null, projects: [] }} />)).toContain(researchProgramAccountCopy.ru.pending);
  const baseline = { ...data, participation: { ...data.participation!, status: "completed" as const, baseline: true, mentorAssigned: false, mentor: null }, projects: [] };
  const html = renderToStaticMarkup(<ResearchProgramParticipation locale="en" data={baseline} />);
  expect(html).toContain(researchProgramAccountCopy.en.completed); expect(html).toContain(researchProgramAccountCopy.en.baseline);
  expect(html).toContain(researchProgramAccountCopy.en.noMentor); expect(html).toContain(researchProgramAccountCopy.en.noProjects);
  expect(html).not.toContain(researchProgramAccountCopy.en.started);
  const noResults = renderToStaticMarkup(<ResearchProgramParticipation locale="kk" data={{ ...data, participation: { ...data.participation!, mentor: null }, projects: [{ ...data.projects[0], outputs: [] }] }} />);
  expect(noResults).toContain(researchProgramAccountCopy.kk.unavailableMentor); expect(noResults).toContain(researchProgramAccountCopy.kk.noOutputs);
});
it("avoids unsafe external links and strips unexpected private DTO fields", () => {
  const dirty = { ...data, email: "secret@example.org", manager_note: "SECRET", participation: { ...data.participation, mentorId: id }, projects: [{ ...data.projects[0], outputs: [{ ...data.projects[0].outputs[0], externalUrl: "javascript:alert(1)" }] }] };
  const parsed = accountResearchProgramSchema.parse(dirty);
  const html = renderToStaticMarkup(<ResearchProgramParticipation locale="ru" data={parsed} />);
  expect(html).not.toContain("javascript:"); expect(JSON.stringify(parsed)).not.toMatch(/secret@example|mentorId|manager_note/);
});
it("never loads participant data for absent or unrelated records, and hides failure details", async () => {
  mocks.get.mockResolvedValueOnce(null); await expect(AccountDetailPage(props())).rejects.toThrow("not_found"); expect(mocks.account).not.toHaveBeenCalled();
  mocks.account.mockRejectedValueOnce(new Error("secret@example.org")); const html = renderToStaticMarkup(await AccountDetailPage(props()));
  expect(html).toContain(researchProgramAccountCopy.ru.unavailable); expect(html).not.toContain("secret@example.org");
  mocks.account.mockRejectedValueOnce(new AccountRecordsError("session")); await expect(AccountDetailPage(props("kk"))).rejects.toThrow("redirect:/kk/account/login");
});
it("shows mentor assignment only for active participation with the current version", async () => {
  const application = { id, programId: work, locale: "ru" as const, fullName: "Applicant", email: "applicant@example.org", status: "accepted" as const, motivation: "Motivation", managerNote: "Internal", createdAt: "2026-10-01", consentAt: "2026-10-01" };
  const access: AccessContext = { userId: id, roles: new Set(), permissions: new Set(["admin.access", "research_program.manage"]) };
  mocks.participation.mockResolvedValue({ status: "active", mentorId: work, version: 5 });
  const html = renderToStaticMarkup(await ResearchProgramApplicationCard({ application, access, scientists: [{ id: work, name: "Program mentor" }], queue: true }));
  expect(html).toContain('name="mentorId"'); expect(html).toContain('name="version" value="5"'); expect(html).toContain('value="queue"');
  mocks.participation.mockResolvedValue({ status: "completed", mentorId: work, version: 6 });
  const completed = renderToStaticMarkup(await ResearchProgramApplicationCard({ application: { ...application, status: "completed" }, access, scientists: [{ id: work, name: "Program mentor" }] }));
  expect(completed).not.toContain('name="mentorId"'); expect(completed).toContain("Program mentor");
});
