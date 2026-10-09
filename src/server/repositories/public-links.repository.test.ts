import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@/lib/supabase/database";
vi.mock("server-only", () => ({}));
import { ArticleRelationsRepository } from "./article-relations.repository";
import { PublicationRepository } from "./publication.repository";

describe("public RPC links after locale routing", () => {
  it("normalizes forward/reverse links without changing the visibility RPC", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ kind: "scientist", entity_id: "person", title: "Ғалым", href: "/scientists/kk/person", relation_type: "expert" }], error: null })
      .mockResolvedValueOnce({ data: [{ id: "article", title: "Материал", href: "/journal/ru/article", excerpt: "Summary", relation_type: "subject" }], error: null });
    const repository = new ArticleRelationsRepository({ rpc } as unknown as DatabaseClient);
    expect(await repository.publicRelations("article", "kk")).toEqual([{ kind: "scientist", entityId: "person", title: "Ғалым", href: "/kk/scientists/person", relationType: "expert" }]);
    expect(await repository.relatedArticles("scientist", "person", "ru")).toEqual([{ id: "article", title: "Материал", href: "/ru/journal/article", excerpt: "Summary", relationType: "subject" }]);
    expect(rpc).toHaveBeenCalledWith("public_article_relations", { p_article: "article", p_locale: "kk" });
    expect(rpc).toHaveBeenCalledWith("public_related_articles", { p_kind: "scientist", p_entity: "person", p_locale: "ru" });
  });
  it("normalizes scientist links returned with scientific publications", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "paper", scientist_id: "person", title: "Paper", year: 2026, journal: "Journal", doi: null, url: null, publication_type: "article", scientist_name: "Ғалым", scientist_href: "/scientists/kk/person" }], error: null });
    const repository = new PublicationRepository({ rpc } as unknown as DatabaseClient);
    expect(await repository.listPublic("kk", "paper", "person")).toMatchObject([{ id: "paper", scientistHref: "/kk/scientists/person" }]);
    expect(rpc).toHaveBeenCalledWith("list_public_publications", { p_locale: "kk", p_id: "paper", p_scientist: "person" });
  });
  it("propagates database failures rather than returning unfiltered links", async () => {
    const error = { message: "permission denied" };
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error }) } as unknown as DatabaseClient;
    await expect(new ArticleRelationsRepository(client).publicRelations("article", "kk")).rejects.toBe(error);
    await expect(new PublicationRepository(client).listPublic("kk")).rejects.toBe(error);
  });
});

describe("scientific graph public DTO", () => {
  const person = "00000000-0000-4000-a000-000000000001";
  const work = "00000000-0000-4000-a000-000000000002";
  const row = { id: "paper", scientist_id: person, title: "Paper", year: 2026, journal: "Journal", doi: null, url: null, publication_type: "article", scientist_name: "Ғалым", scientist_href: "/scientists/kk/person", authors: [{ scientistId: person, name: "Ғалым", href: "/scientists/kk/person", affiliation: "", accountEmail: "must not be returned" }], works: [{ id: work, kind: "research", title: "Зерттеу", href: "/research/kk/study" }] };
  it("normalizes author/work links and discards unrequested fields for reverse work reads", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const [result] = await new PublicationRepository({ rpc } as unknown as DatabaseClient).listPublicByWork("kk", work);
    expect(result.authors).toEqual([{ scientistId: person, name: "Ғалым", href: "/kk/scientists/person", affiliation: "" }]);
    expect(result.works).toEqual([{ id: work, kind: "research", title: "Зерттеу", href: "/kk/research/study" }]);
    expect(rpc).toHaveBeenCalledWith("list_public_work_publications", { p_locale: "kk", p_work: work });
  });
  it("rejects malformed scientific graph JSON rather than rendering an unchecked payload", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ...row, works: [{ ...row.works[0], kind: "editorial" }] }], error: null });
    await expect(new PublicationRepository({ rpc } as unknown as DatabaseClient).listPublic("kk")).rejects.toThrow();
  });
});

describe("administrative publication snapshot", () => {
  it("loads bibliography and complete child collections together and restores author order", async () => {
    const row = { id: "paper", scientist_id: "primary", title: "Paper", year: 2026, journal: "Journal", doi: null, url: null, publication_type: "article", status: "draft", updated_at: "2026-10-10T05:00:00Z", publication_coauthors: [{ sort_order: 2, scientist_id: null, name: "External", affiliation: "Institute" }, { sort_order: 0, scientist_id: "coauthor", name: null, affiliation: "" }], publication_works: [{ work_id: "work-b" }, { work_id: "work-a" }] };
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) };
    const repository = new PublicationRepository({ from: vi.fn(() => query) } as unknown as DatabaseClient);
    expect(await repository.getById("paper")).toMatchObject({ id: "paper", coauthors: [{ scientistId: "coauthor", name: "", affiliation: "" }, { scientistId: null, name: "External", affiliation: "Institute" }], workIds: ["work-a", "work-b"] });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); expect(await repository.getById("missing")).toBeNull();
  });
});
