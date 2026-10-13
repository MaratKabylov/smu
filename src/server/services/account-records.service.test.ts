import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), client: vi.fn(), user: vi.fn(), rpc: vi.fn(), access: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/access.repository", () => ({ AccessRepository: class { getForUser = mocks.access; } }));
import { AccountRecordsService } from "./account-records.service";
const service = new AccountRecordsService();
const id = "00000000-0000-4000-a000-000000000001";
const user = { id, email: "own@example.org", email_confirmed_at: "2026-10-12", is_anonymous: false, user_metadata: { role: "super_admin", email: "other@example.org" } };
const record = { id, kind: "article", title: "My article", status: "draft", updatedAt: "2026-10-12", locale: "ru", summary: "Summary", body: "Private body", content: null, relationship: "owner" };
const page = (items: unknown[] = [record]) => ({ total: items.length, page: 1, pageSize: 20, items });
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured.mockReturnValue(true);
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc });
  mocks.user.mockResolvedValue({ data: { user }, error: null });
  mocks.rpc.mockResolvedValue({ data: page(), error: null });
  mocks.access.mockResolvedValue({ userId: id, roles: new Set(), permissions: new Set() });
});

describe("session-scoped account records", () => {
  it("validates runtime locale, section, pagination and IDs before opening a session", async () => {
    // @ts-expect-error unsupported runtime locale
    await expect(service.list("de", "articles")).rejects.toThrow("invalid");
    // @ts-expect-error unsupported runtime section
    await expect(service.list("ru", "audit")).rejects.toThrow("invalid");
    for (const n of [0, 1.5, 100001, NaN]) await expect(service.list("ru", "articles", n)).rejects.toThrow("invalid");
    await expect(service.get("ru", "articles", "other's UUID")).rejects.toThrow("invalid");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rejects expired, unconfirmed, anonymous and failed Auth sessions for reads, details and mutations", async () => {
    for (const session of [{ data: { user: null } }, { data: { user: { ...user, email_confirmed_at: null } } }, { data: { user: { ...user, is_anonymous: true } } }, { data: { user: { ...user, email: null } } }, { data: { user }, error: { message: "Auth secret" } }]) {
      mocks.user.mockResolvedValue(session);
      await expect(service.list("ru", "projects")).rejects.toThrow("session");
      await expect(service.get("ru", "scientist", id)).rejects.toThrow("session");
      await expect(service.claimApplications()).rejects.toThrow("session");
      await expect(service.mentorshipProgress(id)).rejects.toThrow("session");
      await expect(service.withdrawMentorship(id)).rejects.toThrow("session");
      await expect(service.researchProgram(id, "ru")).rejects.toThrow("session");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not call clients when unconfigured", async () => {
    mocks.configured.mockReturnValue(false);
    await expect(service.list("ru", "articles")).rejects.toThrow("setup");
    await expect(service.claimApplications()).rejects.toThrow("setup");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("validates participant reads and calls only the account RPC without trusting admin metadata", async () => {
    await expect(service.researchProgram("invalid", "ru")).rejects.toThrow("invalid");
    // @ts-expect-error invalid runtime locale
    await expect(service.researchProgram(id, "de")).rejects.toThrow("invalid");
    expect(mocks.client).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await service.researchProgram(id, "kk")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_account_research_program", { p_application: id, p_locale: "kk" });
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("uses the session RPC without accepting or forwarding identity, email or metadata", async () => {
    expect(await service.list("kk", "projects", 2)).toEqual(page());
    expect(mocks.rpc).toHaveBeenCalledWith("list_account_records", { p_locale: "kk", p_section: "projects", p_page: 2, p_id: null });
    mocks.rpc.mockResolvedValue({ data: 2, error: null }); expect(await service.claimApplications()).toBe(2);
    expect(mocks.rpc).toHaveBeenLastCalledWith("claim_account_applications");
  });
  it("returns no detail or editor for records absent from the ownership RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: page([]), error: null });
    expect(await service.get("en", "articles", id)).toBeNull(); expect(mocks.access).not.toHaveBeenCalled();
  });
  it("hides shared editors without actual admin and resource permissions", async () => {
    expect((await service.get("ru", "articles", id))?.editor).toBeNull();
    mocks.access.mockResolvedValue({ userId: id, roles: new Set(), permissions: new Set(["articles.edit_own"]) });
    expect((await service.get("ru", "articles", id))?.editor).toBeNull();
    mocks.access.mockResolvedValue({ userId: id, roles: new Set(), permissions: new Set(["admin.access"]) });
    expect((await service.get("ru", "articles", id))?.editor).toBeNull();
    mocks.access.mockResolvedValue({ userId: id, roles: new Set(), permissions: new Set(["admin.access", "articles.edit_own"]) });
    expect((await service.get("ru", "articles", id))?.editor).toBe(`/admin/content/articles/${id}`);
    expect(mocks.access).toHaveBeenLastCalledWith(id);
  });
  it.each([["scientist", "scientist", "scientists.edit", "scientists"], ["projects", "project", "projects.manage", "projects"], ["projects", "research", "research.manage", "research"]] as const)("reuses the permitted %s editor", async (section, kind, permission, path) => {
    mocks.rpc.mockResolvedValue({ data: page([{ ...record, kind }]), error: null });
    mocks.access.mockResolvedValue({ userId: id, roles: new Set(), permissions: new Set(["admin.access", permission]) });
    expect((await service.get("ru", section, id))?.editor).toBe(`/admin/science/${path}/${id}`);
  });
  it("strips unexpected DB properties and ignores unsafe rich text", async () => {
    mocks.rpc.mockResolvedValue({ data: page([{ ...record, manager_note: "secret", email: "secret@example.org", content: { type: "script", text: "alert(1)" } }]), error: null });
    const result = await service.list("ru", "articles"); expect(result.items[0].content).toBeNull(); expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("propagates database refusal and rejects malformed DTOs and mutation results", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: new Error("forbidden"), data: null }); await expect(service.list("ru", "articles")).rejects.toThrow("forbidden");
    mocks.rpc.mockResolvedValueOnce({ data: { items: [{ id: "not-a-UUID" }] }, error: null }); await expect(service.list("ru", "articles")).rejects.toThrow();
    for (const value of [null, -1, 1.5, "2"]) { mocks.rpc.mockResolvedValueOnce({ data: value, error: null }); await expect(service.claimApplications()).rejects.toThrow("Invalid claim result"); }
  });
  it("constrains mentorship progress to account ownership even for a manager", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: page([]), error: null });
    expect(await service.mentorshipProgress(id)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("list_account_records", { p_locale: "ru", p_section: "applications", p_page: 1, p_id: id });
    mocks.rpc.mockResolvedValueOnce({ data: page([{ ...record, kind: "mentorship_application" }]), error: null })
      .mockResolvedValueOnce({ data: { applicationStatus: "accepted", relation: null, historyTotal: 0, history: [], managerNote: "SECRET" }, error: null });
    expect(await service.mentorshipProgress(id)).toEqual({ applicationStatus: "accepted", relation: null, historyTotal: 0, history: [] });
    expect(mocks.rpc).toHaveBeenLastCalledWith("get_mentorship_progress", { p_application: id });
  });
  it("withdraws using only the record ID and rejects invalid IDs before Auth", async () => {
    await expect(service.withdrawMentorship("invalid")).rejects.toThrow("invalid");
    await expect(service.mentorshipProgress("invalid")).rejects.toThrow("invalid");
    expect(mocks.client).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null }); await service.withdrawMentorship(id);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("withdraw_mentorship_application", { p_id: id });
  });
});
