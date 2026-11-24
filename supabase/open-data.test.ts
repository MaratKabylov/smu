import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";

let db: PGlite | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

async function seed(database: PGlite) {
  await database.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
}

describe("Open Data Aktobe database", () => {
  it("creates tables, permission, and seeds default data", async () => {
    db = await createMigrationDatabase();
    await seed(db);

    const { rows: settingsRows } = await db.query<{
      title_ru: string;
      title_kk: string;
      is_published: boolean;
      show_on_homepage: boolean;
    }>("select title_ru, title_kk, is_published, show_on_homepage from public.open_data_settings");

    expect(settingsRows).toHaveLength(1);
    expect(settingsRows[0].title_ru).toBe("Open Data Aktobe");
    expect(settingsRows[0].is_published).toBe(true);
    expect(settingsRows[0].show_on_homepage).toBe(true);

    const { rows: metricRows } = await db.query<{ count: number }>(
      "select count(*)::int as count from public.open_data_metrics"
    );
    expect(metricRows[0].count).toBe(7);

    const { rows: homeMetricRows } = await db.query<{ count: number }>(
      "select count(*)::int as count from public.open_data_metrics where show_on_homepage = true"
    );
    expect(homeMetricRows[0].count).toBe(4);

    const { rows: categoryRows } = await db.query<{ count: number }>(
      "select count(*)::int as count from public.open_data_categories"
    );
    expect(categoryRows[0].count).toBe(15);

    const { rows: homeCategoryRows } = await db.query<{ count: number }>(
      "select count(*)::int as count from public.open_data_categories where show_on_homepage = true"
    );
    expect(homeCategoryRows[0].count).toBe(6);

    const { rows: permRows } = await db.query<{ count: number }>(
      "select count(*)::int as count from public.permissions where code = 'open_data.manage'"
    );
    expect(permRows[0].count).toBe(1);
  });

  it("enforces non-negative value constraints on metrics and categories", async () => {
    db = await createMigrationDatabase();
    await seed(db);

    // Negative metric value should be rejected by check constraint
    await expect(
      db.query(
        "insert into public.open_data_metrics (code, title_ru, title_kk, value_numeric) values ('test_neg', 'Тест', 'Тест', -10)"
      )
    ).rejects.toThrow();

    // Zero should be accepted
    await expect(
      db.query(
        "insert into public.open_data_metrics (code, title_ru, title_kk, value_numeric) values ('test_zero', 'Тест', 'Тест', 0)"
      )
    ).resolves.toBeDefined();

    // Negative category count should be rejected
    await expect(
      db.query(
        "insert into public.open_data_categories (slug, title_ru, title_kk, dataset_count) values ('test-neg', 'Тест', 'Тест', -1)"
      )
    ).rejects.toThrow();

    // Invalid category status should be rejected
    await expect(
      db.query(
        "insert into public.open_data_categories (slug, title_ru, title_kk, status) values ('test-invalid-status', 'Тест', 'Тест', 'not_a_valid_status')"
      )
    ).rejects.toThrow();
  });
});
