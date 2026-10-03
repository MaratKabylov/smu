import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { EventRepository } from "./event.repository";

type Call = { table: string; operation: string; args: unknown[] };
function clientWith(rows: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const query: Record<string, unknown> = {};
      for (const operation of ["select", "eq", "is", "in", "order", "limit", "like", "ilike", "gt", "lte"]) {
        query[operation] = (...args: unknown[]) => { calls.push({ table, operation, args }); return query; };
      }
      query.maybeSingle = () => Promise.resolve({ data: rows[table]?.[0] ?? null, error: null });
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
      return query;
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "https://example.kz/image.jpg" } }) }) },
  };
  return { client: client as unknown as SupabaseClient, calls };
}
const filters = { locale: "ru" as const, query: "", kind: "all" as const, format: "all" as const, period: "upcoming" as const };
describe("public event queries with manager sessions", () => {
  it("constrains public state and deletion and includes ongoing events", async () => {
    const { client, calls } = clientWith({});
    await new EventRepository(client).listPublic(filters, new Date("2026-10-03T00:00:00Z"));
    expect(calls).toContainEqual({ table: "events", operation: "in", args: ["status", ["published", "cancelled"]] });
    expect(calls).toContainEqual({ table: "events", operation: "is", args: ["deleted_at", null] });
    expect(calls).toContainEqual({ table: "events", operation: "gt", args: ["ends_at", "2026-10-03T00:00:00.000Z"] });
  });
  it("applies past period and format and kind before the result limit", async () => {
    const { client, calls } = clientWith({});
    await new EventRepository(client).listPublic({ ...filters, period: "past", kind: "seminar", format: "online" }, new Date("2026-10-03T00:00:00Z"));
    expect(calls).toContainEqual({ table: "events", operation: "lte", args: ["ends_at", "2026-10-03T00:00:00.000Z"] });
    expect(calls).toContainEqual({ table: "events", operation: "eq", args: ["kind", "seminar"] });
    expect(calls).toContainEqual({ table: "events", operation: "eq", args: ["format", "online"] });
    expect(calls).toContainEqual({ table: "events", operation: "order", args: ["starts_at", { ascending: false }] });
  });
  it("constrains slug lookups even when a manager can read draft translations", async () => {
    const { client, calls } = clientWith({ event_translations: [{ event_id: "draft" }] });
    expect(await new EventRepository(client).getPublicBySlug("kk", "draft-kk")).toBeNull();
    expect(calls).toContainEqual({ table: "events", operation: "in", args: ["status", ["published", "cancelled"]] });
    expect(calls).toContainEqual({ table: "events", operation: "is", args: ["deleted_at", null] });
  });
  it("escapes wildcard search characters and limits search to the selected language", async () => {
    const { client, calls } = clientWith({});
    await new EventRepository(client).listPublic({ ...filters, query: "100%_" });
    expect(calls).toContainEqual({ table: "event_translations", operation: "ilike", args: ["title", "%100\\%\\_%"] });
    expect(calls).toContainEqual({ table: "event_translations", operation: "eq", args: ["locale", "ru"] });
  });
});
