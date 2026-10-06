import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { ArticleRelationsRepository } from "./article-relations.repository";
import { PublicationRepository } from "./publication.repository";

describe("public RPC links after locale routing", () => {
  it("normalizes forward/reverse links without changing the visibility RPC", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ kind: "scientist", entity_id: "person", title: "Ғалым", href: "/scientists/kk/person", relation_type: "expert" }], error: null })
      .mockResolvedValueOnce({ data: [{ id: "article", title: "Материал", href: "/journal/ru/article", excerpt: "Summary", relation_type: "subject" }], error: null });
    const repository = new ArticleRelationsRepository({ rpc } as unknown as SupabaseClient);
    expect(await repository.publicRelations("article", "kk")).toEqual([{ kind: "scientist", entityId: "person", title: "Ғалым", href: "/kk/scientists/person", relationType: "expert" }]);
    expect(await repository.relatedArticles("scientist", "person", "ru")).toEqual([{ id: "article", title: "Материал", href: "/ru/journal/article", excerpt: "Summary", relationType: "subject" }]);
    expect(rpc).toHaveBeenCalledWith("public_article_relations", { p_article: "article", p_locale: "kk" });
    expect(rpc).toHaveBeenCalledWith("public_related_articles", { p_kind: "scientist", p_entity: "person", p_locale: "ru" });
  });
  it("normalizes scientist links returned with scientific publications", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "paper", scientist_id: "person", title: "Paper", year: 2026, journal: "Journal", doi: null, url: null, publication_type: "article", scientist_name: "Ғалым", scientist_href: "/scientists/kk/person" }], error: null });
    const repository = new PublicationRepository({ rpc } as unknown as SupabaseClient);
    expect(await repository.listPublic("kk", "paper", "person")).toMatchObject([{ id: "paper", scientistHref: "/kk/scientists/person" }]);
    expect(rpc).toHaveBeenCalledWith("list_public_publications", { p_locale: "kk", p_id: "paper", p_scientist: "person" });
  });
  it("propagates database failures rather than returning unfiltered links", async () => {
    const error = { message: "permission denied" };
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error }) } as unknown as SupabaseClient;
    await expect(new ArticleRelationsRepository(client).publicRelations("article", "kk")).rejects.toBe(error);
    await expect(new PublicationRepository(client).listPublic("kk")).rejects.toBe(error);
  });
});
