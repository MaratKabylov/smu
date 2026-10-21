import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { HomepageRepository } from "./homepage.repository";

it("counts only public scientists, published projects, and active partner organizations", async () => {
  const counts = new Map([
    ["scientist_profiles", 42],
    ["science_works", 17],
    ["scientific_organizations", 9],
  ]);
  const queries: { table: string; options?: object; filters: [string, string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const queryState = { table, options: undefined as object | undefined, filters: [] as [string, string, unknown][] };
      queries.push(queryState);
      const query = {
        select(_columns: string, options: object) { queryState.options = options; return query; },
        eq(column: string, value: unknown) { queryState.filters.push(["eq", column, value]); return query; },
        is(column: string, value: unknown) { queryState.filters.push(["is", column, value]); return query; },
        then(resolve: (value: { count: number; error: null }) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ count: counts.get(table) ?? 0, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };

  await expect(new HomepageRepository(client as never).metrics()).resolves.toEqual({ scientists: 42, researchProjects: 17, partners: 9 });
  expect(queries.map(query => [query.table, query.options, query.filters])).toEqual([
    ["scientist_profiles", { count: "exact", head: true }, [["eq", "status", "verified"], ["eq", "is_public", true], ["is", "deleted_at", null]]],
    ["science_works", { count: "exact", head: true }, [["eq", "kind", "project"], ["eq", "status", "published"], ["is", "deleted_at", null]]],
    ["scientific_organizations", { count: "exact", head: true }, [["eq", "is_active", true]]],
  ]);
});
