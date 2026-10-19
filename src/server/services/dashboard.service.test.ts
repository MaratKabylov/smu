import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.session }));
import { DashboardService } from "./dashboard.service";
import type { AccessContext } from "@/types/domain/auth";
const id = "00000000-0000-4000-a000-000000000001";
const access: AccessContext = { userId: id, roles: new Set(["author"]), permissions: new Set(["admin.access", "articles.edit_own"]) };
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ rpc: mocks.rpc }); });
it("denies missing admin access before creating a session client", async () => {
  await expect(new DashboardService().read({ ...access, permissions: new Set(["articles.edit_own"]) })).rejects.toThrow("forbidden");
  expect(mocks.session).not.toHaveBeenCalled();
});
it("uses a session RPC and filters each metric and list by the application access context", async () => {
  mocks.rpc.mockResolvedValue({ data: { metrics: { own_drafts: 0, article_drafts: 99, it_requests: 4, pending_scientists: 3 },
    ownDrafts: [], reviewQueue: [{ id, title: "Closed" }], recentActions: [{ id, created_at: "2026-10-19", entity_type: "article", action: "saved" }] }, error: null });
  expect(await new DashboardService().read(access)).toEqual({ metrics: { own_drafts: 0 }, ownDrafts: [], reviewQueue: [], recentActions: [] });
  expect(mocks.rpc).toHaveBeenCalledWith("read_admin_dashboard");
});
it("rejects malformed projections and propagates DB errors instead of showing false zeroes", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { metrics: { own_drafts: -1 }, ownDrafts: [], reviewQueue: [], recentActions: [] }, error: null });
  await expect(new DashboardService().read(access)).rejects.toThrow();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("offline") });
  await expect(new DashboardService().read(access)).rejects.toThrow("offline");
});
