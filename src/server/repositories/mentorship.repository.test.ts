import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@/lib/supabase/database";
vi.mock("server-only", () => ({}));
const taxonomy = vi.hoisted(() => ({ fields: [{ id: "field", slug: "science", nameRu: "Наука", nameKk: "Ғылым", isActive: true }], organizations: [] }));
vi.mock("@/server/repositories/scientist.repository", () => ({ ScientistRepository: class { async listTaxonomy() { return taxonomy; } } }));
vi.mock("@/server/repositories/science-work.repository", () => ({ ScienceWorkRepository: class {} }));
import { MentorshipRepository } from "./mentorship.repository";
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
  return { client: client as unknown as DatabaseClient, calls };
}
const offer = { id: "offer", scientist_id: "mentor", field_id: "field", status: "published", capacity: 3, format: "online" };
const translations = [{ offer_id: "offer", locale: "ru", slug: "mentor", title: "Research mentoring", summary: "Summary", description: "Description" }];
const mentor = [{ scientist_profile_id: "mentor", locale: "ru", full_name: "Mentor Scientist", slug: "mentor" }];
const filters = { locale: "ru" as const, query: "", field: "", format: "all" as const };
describe("public mentorship with an administrator session", () => {
  it("explicitly limits catalogue and slug lookup to published, non-deleted offers", async () => {
    const { client, calls } = mockClient({ mentorship_offer_translations: translations });
    const repository = new MentorshipRepository(client);
    await repository.listPublic(filters); expect(await repository.getPublicBySlug("ru", "mentor")).toBeNull();
    expect(calls.filter(call => call.table === "mentorship_offers" && call.operation === "eq" && call.args[0] === "status")).toEqual([
      { table: "mentorship_offers", operation: "eq", args: ["status", "published"] },
      { table: "mentorship_offers", operation: "eq", args: ["status", "published"] },
    ]);
    expect(calls.filter(call => call.table === "mentorship_offers" && call.operation === "is")).toHaveLength(2);
  });
  it("hides offers when the mentor is unverified or soft-deleted, even with manager RLS", async () => {
    const { client, calls } = mockClient({ mentorship_offers: [offer], mentorship_offer_translations: translations });
    expect(await new MentorshipRepository(client).getPublicBySlug("ru", "mentor")).toBeNull();
    expect(calls).toContainEqual({ table: "scientist_profiles", operation: "eq", args: ["status", "verified"] });
    expect(calls).toContainEqual({ table: "scientist_profiles", operation: "is", args: ["deleted_at", null] });
  });
  it("hides offers with unavailable directions or missing mentor translations", async () => {
    const unavailable = mockClient({ mentorship_offers: [{ ...offer, field_id: "inactive" }], mentorship_offer_translations: translations, scientist_profiles: [{ id: "mentor" }], scientist_profile_translations: mentor });
    expect(await new MentorshipRepository(unavailable.client).getPublicBySlug("ru", "mentor")).toBeNull();
    const missingTranslation = mockClient({ mentorship_offers: [offer], mentorship_offer_translations: translations, scientist_profiles: [{ id: "mentor" }], scientist_profile_translations: [{ ...mentor[0], locale: "kk" }] });
    expect(await new MentorshipRepository(missingTranslation.client).getPublicBySlug("ru", "mentor")).toBeNull();
  });
  it("hydrates public offers without ever querying applicant information", async () => {
    const { client, calls } = mockClient({ mentorship_offers: [offer], mentorship_offer_translations: translations, scientist_profiles: [{ id: "mentor" }], scientist_profile_translations: mentor });
    const result = await new MentorshipRepository(client).getPublicBySlug("ru", "mentor");
    expect(result?.mentor[0].fullName).toBe("Mentor Scientist");
    expect(calls.some(call => call.table === "mentorship_applications")).toBe(false);
  });
  it("escapes SQL search wildcards and rejects unknown field filters", async () => {
    const { client, calls } = mockClient();
    await new MentorshipRepository(client).listPublic({ ...filters, query: "100%_" });
    expect(calls).toContainEqual({ table: "mentorship_offer_translations", operation: "ilike", args: ["title", "%100\\%\\_%"] });
    const unknown = mockClient();
    expect((await new MentorshipRepository(unknown.client).listPublic({ ...filters, field: "unknown" })).offers).toEqual([]);
    expect(unknown.calls.some(call => call.operation === "execute")).toBe(false);
  });
});
