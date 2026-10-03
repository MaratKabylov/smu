import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
const taxonomy = vi.hoisted(() => ({ fields: [{ id: "field", slug: "science", nameRu: "Наука", nameKk: "Ғылым", isActive: true }], organizations: [] }));
vi.mock("@/server/repositories/scientist.repository", () => ({ ScientistRepository: class { async listTaxonomy() { return taxonomy; } } }));
vi.mock("@/server/repositories/science-work.repository", () => ({ ScienceWorkRepository: class {} }));
import { ResearchProgramRepository } from "./research-program.repository";
type Call = { table: string; operation: string; args: unknown[] };
function mockClient(rows: Record<string, unknown[]> = {}) {
  const calls: Call[] = [];
  const client = { from(table: string) {
    const query: Record<string, unknown> = {};
    for (const operation of ["select", "eq", "is", "in", "order", "limit", "ilike"]) {
      query[operation] = (...args: unknown[]) => { calls.push({ table, operation, args }); return query; };
    }
    query.maybeSingle = () => Promise.resolve({ data: rows[table]?.[0] ?? null, error: null });
    query.then = (resolve: (value: unknown) => unknown) => { calls.push({ table, operation: "execute", args: [] }); return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve); };
    return query;
  } };
  return { client: client as unknown as SupabaseClient, calls };
}
const program = { id: "program", coordinator_id: "coordinator", field_id: "field", status: "published", capacity: 3, format: "online", applications_open_on: "2026-10-01", application_deadline: "2026-10-15", starts_on: "2026-11-01", ends_on: "2026-12-01" };
const translations = [{ program_id: "program", locale: "ru", slug: "coordinator", title: "Research skills", summary: "Summary", description: "Description", curriculum: "Research methods", eligibility: "Young scientists", outcomes: "Scientific project" }];
const coordinator = [{ scientist_profile_id: "coordinator", locale: "ru", full_name: "Program Coordinator", slug: "coordinator" }];
const filters = { locale: "ru" as const, query: "", field: "", format: "all" as const };
describe("public research programs with an administrator session", () => {
  it("explicitly limits catalogue and slug lookup to published, non-deleted programs", async () => {
    const { client, calls } = mockClient({ research_program_translations: translations });
    const repository = new ResearchProgramRepository(client);
    await repository.listPublic(filters); expect(await repository.getPublicBySlug("ru", "coordinator")).toBeNull();
    expect(calls.filter(call => call.table === "research_programs" && call.operation === "eq" && call.args[0] === "status")).toEqual([
      { table: "research_programs", operation: "eq", args: ["status", "published"] },
      { table: "research_programs", operation: "eq", args: ["status", "published"] },
    ]);
    expect(calls.filter(call => call.table === "research_programs" && call.operation === "is")).toHaveLength(2);
  });
  it("hides programs when the coordinator is unverified or soft-deleted, even with manager RLS", async () => {
    const { client, calls } = mockClient({ research_programs: [program], research_program_translations: translations });
    expect(await new ResearchProgramRepository(client).getPublicBySlug("ru", "coordinator")).toBeNull();
    expect(calls).toContainEqual({ table: "scientist_profiles", operation: "eq", args: ["status", "verified"] });
    expect(calls).toContainEqual({ table: "scientist_profiles", operation: "is", args: ["deleted_at", null] });
  });
  it("hides programs with unavailable directions or missing coordinator translations", async () => {
    const unavailable = mockClient({ research_programs: [{ ...program, field_id: "inactive" }], research_program_translations: translations, scientist_profiles: [{ id: "coordinator" }], scientist_profile_translations: coordinator });
    expect(await new ResearchProgramRepository(unavailable.client).getPublicBySlug("ru", "coordinator")).toBeNull();
    const missingTranslation = mockClient({ research_programs: [program], research_program_translations: translations, scientist_profiles: [{ id: "coordinator" }], scientist_profile_translations: [{ ...coordinator[0], locale: "kk" }] });
    expect(await new ResearchProgramRepository(missingTranslation.client).getPublicBySlug("ru", "coordinator")).toBeNull();
  });
  it("hydrates public programs without ever querying applicant information", async () => {
    const { client, calls } = mockClient({ research_programs: [program], research_program_translations: translations, scientist_profiles: [{ id: "coordinator" }], scientist_profile_translations: coordinator });
    const result = await new ResearchProgramRepository(client).getPublicBySlug("ru", "coordinator");
    expect(result?.coordinator[0].fullName).toBe("Program Coordinator");
    expect(result?.applicationDeadline).toBe("2026-10-15");
    expect(result?.translations[0].curriculum).toBe("Research methods");
    expect(result?.translations[0].eligibility).toBe("Young scientists");
    expect(result?.translations[0].outcomes).toBe("Scientific project");
    expect(calls.some(call => call.table === "research_program_applications")).toBe(false);
  });
  it("escapes SQL search wildcards and rejects unknown field filters", async () => {
    const { client, calls } = mockClient();
    await new ResearchProgramRepository(client).listPublic({ ...filters, query: "100%_" });
    expect(calls).toContainEqual({ table: "research_program_translations", operation: "ilike", args: ["title", "%100\\%\\_%"] });
    const unknown = mockClient();
    expect((await new ResearchProgramRepository(unknown.client).listPublic({ ...filters, field: "unknown" })).programs).toEqual([]);
    expect(unknown.calls.some(call => call.operation === "execute")).toBe(false);
  });
});
