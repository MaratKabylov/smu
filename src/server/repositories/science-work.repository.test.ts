import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@/lib/supabase/database";
vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/scientist.repository", () => ({
  ScientistRepository: class { async listTaxonomy() { return { organizations: [], fields: [] }; } },
}));
import { ScienceWorkRepository } from "./science-work.repository";

type Call = { table: string; operation: string; args: unknown[] };
function clientWith(rows: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const query: Record<string, unknown> = {};
      for (const operation of ["select", "eq", "is", "in", "order", "limit", "like", "ilike"]) {
        query[operation] = (...args: unknown[]) => { calls.push({ table, operation, args }); return query; };
      }
      query.maybeSingle = () => Promise.resolve({ data: rows[table]?.[0] ?? null, error: null });
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
      return query;
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "https://example.kz/image.jpg" } }) }) },
  };
  return { client: client as unknown as DatabaseClient, calls };
}
describe("public scientific work queries with a manager session", () => {
  it("constrains list queries by publication, kind and soft delete", async () => {
    const { client, calls } = clientWith({});
    await new ScienceWorkRepository(client).listPublic("research", { locale: "ru", query: "", organization: "", field: "", stage: "all" });
    expect(calls).toContainEqual({ table: "science_works", operation: "eq", args: ["status", "published"] });
    expect(calls).toContainEqual({ table: "science_works", operation: "eq", args: ["kind", "research"] });
    expect(calls).toContainEqual({ table: "science_works", operation: "is", args: ["deleted_at", null] });
  });
  it("constrains slug lookup even when the session can read draft translations", async () => {
    const { client, calls } = clientWith({ science_work_translations: [{ work_id: "draft-id" }] });
    expect(await new ScienceWorkRepository(client).getPublicBySlug("project", "kk", "draft-kk")).toBeNull();
    expect(calls).toContainEqual({ table: "science_works", operation: "eq", args: ["status", "published"] });
    expect(calls).toContainEqual({ table: "science_works", operation: "eq", args: ["kind", "project"] });
    expect(calls).toContainEqual({ table: "science_works", operation: "is", args: ["deleted_at", null] });
  });
  it("filters public team members by verified, non-deleted profiles", async () => {
    const { client, calls } = clientWith({
      science_works: [{ id: "work", kind: "project", status: "published", stage: "active", field_id: "field", organization_id: null, cover_media_id: null }],
      science_work_translations: [{ work_id: "work", locale: "ru", title: "Work", slug: "work" }],
      science_work_members: [{ work_id: "work", scientist_id: "private-scientist", role: "lead" }],
      scientist_profiles: [],
    });
    const result = await new ScienceWorkRepository(client).getPublicBySlug("project", "ru", "work");
    expect(result?.members).toEqual([]);
    expect(calls).toContainEqual({ table: "scientist_profiles", operation: "eq", args: ["status", "verified"] });
    expect(calls).toContainEqual({ table: "scientist_profiles", operation: "is", args: ["deleted_at", null] });
  });
  it("escapes wildcard characters in title search", async () => {
    const { client, calls } = clientWith({});
    await new ScienceWorkRepository(client).listPublic("research", { locale: "ru", query: "100%_", organization: "", field: "", stage: "all" });
    expect(calls).toContainEqual({ table: "science_work_translations", operation: "ilike", args: ["title", "%100\\%\\_%"] });
  });
});
