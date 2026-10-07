import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@/lib/supabase/database";
vi.mock("server-only", () => ({}));
import { getPublicSlugRedirect } from "./slug.repository";

function clientWith(results: Array<{ data: unknown; error: unknown }>) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), lte: vi.fn(), maybeSingle: vi.fn() };
  for (const method of [query.select, query.eq, query.is, query.lte]) method.mockReturnValue(query);
  for (const result of results) query.maybeSingle.mockResolvedValueOnce(result);
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as DatabaseClient, query, from };
}
describe("public slug redirects", () => {
  it("checks publication, time and deletion even when the client has an admin session", async () => {
    const { client, query } = clientWith([
      { data: { entity_id: "id" }, error: null }, { data: { id: "id" }, error: null }, { data: { slug: "new-slug" }, error: null },
    ]);
    expect(await getPublicSlugRedirect(client, "article", "ru", "old-slug")).toBe("new-slug");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.lte).toHaveBeenCalledWith("published_at", expect.any(String));
  });
  it("does not disclose a hidden destination", async () => {
    const { client, from } = clientWith([{ data: { entity_id: "id" }, error: null }, { data: null, error: null }]);
    expect(await getPublicSlugRedirect(client, "article", "ru", "old-slug")).toBeNull();
    expect(from).not.toHaveBeenCalledWith("article_translations");
  });
  it("requires verified scientists and prevents self-redirect loops", async () => {
    const { client, query } = clientWith([
      { data: { entity_id: "id" }, error: null }, { data: { id: "id" }, error: null }, { data: { slug: "old-slug" }, error: null },
    ]);
    expect(await getPublicSlugRedirect(client, "scientist", "kk", "old-slug")).toBeNull();
    expect(query.eq).toHaveBeenCalledWith("status", "verified");
    expect(query.lte).not.toHaveBeenCalled();
  });
});
