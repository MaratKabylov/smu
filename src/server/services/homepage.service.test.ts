import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
const mocks = vi.hoisted(() => ({ content: vi.fn(), publicClient: vi.fn(), session: vi.fn(), configured: vi.fn(), search: vi.fn(), results: vi.fn(), events: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.publicClient }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.session }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/server/services/site-content.service", () => ({ getPublicSiteContent: mocks.content }));
vi.mock("@/server/repositories/search.repository", () => ({ SearchRepository: class { publicPage = mocks.search; } }));
vi.mock("@/server/repositories/homepage.repository", () => ({ HomepageRepository: class { results = mocks.results; events = mocks.events; } }));
import { getPublicHomepage } from "./homepage.service";
const settings = { site_name: "SMU", contact_email: "", social_links: [] };
const slot = (key: string, limit = 2) => ({ key, sort_order: 1, display_limit: limit, title: "Custom" });
const cards = Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: `Science ${i}`, summary: "Summary", href: `/kk/research/science-${i}` }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured.mockReturnValue(true); mocks.publicClient.mockReturnValue({});
  mocks.content.mockResolvedValue({ settings, sections: [], page: null });
  mocks.search.mockResolvedValue({ items: cards }); mocks.results.mockResolvedValue([cards[0]]); mocks.events.mockResolvedValue([]);
});
it("loads only enabled configured slots in their stored order, with localized filters and limits", async () => {
  mocks.content.mockResolvedValue({ settings, sections: [slot("opportunities", 1), slot("latest_articles", 3), slot("results", 2), slot("events")], page: null });
  const data = await getPublicHomepage("kk");
  expect(data.sections.map(s => s.key)).toEqual(["opportunities", "latest_articles", "results", "events"]);
  expect(data.sections.map(s => s.items.length)).toEqual([1, 3, 1, 0]);
  expect(mocks.search).toHaveBeenCalledWith("kk", "", "opportunities", { availability: "open" });
  expect(mocks.search).toHaveBeenCalledWith("kk", "", "journal", {});
  expect(mocks.results).toHaveBeenCalledWith("kk", 2); expect(mocks.events).toHaveBeenCalledWith("kk", 2);
  expect(mocks.session).not.toHaveBeenCalled();
});
it("shows a partners link only when that locale has a published information page", async () => {
  mocks.content.mockResolvedValueOnce({ settings, sections: [slot("partners")], page: null }).mockResolvedValueOnce({ page: null });
  expect((await getPublicHomepage("en")).sections[0].items).toEqual([]);
  mocks.content.mockResolvedValueOnce({ settings, sections: [slot("partners")], page: null }).mockResolvedValueOnce({ page: { title: "Partners", summary: "Together" } });
  expect((await getPublicHomepage("en")).sections[0].items[0]).toMatchObject({ title: "Partners", href: "/en/pages/partners" });
  expect(mocks.search).not.toHaveBeenCalled();
});
it("makes no content list requests for disabled blocks or an unconfigured database", async () => {
  expect((await getPublicHomepage("ru")).sections).toEqual([]);
  expect(mocks.search).not.toHaveBeenCalled(); expect(mocks.results).not.toHaveBeenCalled();
  mocks.configured.mockReturnValue(false); mocks.publicClient.mockClear();
  expect(await getPublicHomepage("en")).toEqual({ settings, sections: [] }); expect(mocks.publicClient).not.toHaveBeenCalled();
});
it("propagates configured DB failures instead of presenting an empty published catalogue", async () => {
  mocks.content.mockResolvedValue({ settings, sections: [slot("featured_research")], page: null });
  mocks.search.mockRejectedValueOnce(new Error("offline"));
  await expect(getPublicHomepage("ru")).rejects.toThrow("offline");
});
