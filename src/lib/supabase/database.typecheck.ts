import type { DatabaseClient } from "./database";
import { callDatabaseRpc } from "./database";
import type { Database, Tables } from "@/types/database.types";
import type { createBrowserSupabaseClient } from "./browser";
import type { createServerSupabaseClient } from "./server";
import type { createServiceRoleSupabaseClient } from "./service-role";

export function checkDatabaseContract(client: DatabaseClient) {
  // @ts-expect-error Unknown tables must be rejected.
  client.from("missing_table");
  // @ts-expect-error Unknown RPC names must be rejected.
  client.rpc("missing_rpc", {});
  // @ts-expect-error Missing required arguments must be rejected.
  client.rpc("save_article", {});
  // @ts-expect-error UUID arguments cannot be numbers.
  client.rpc("save_article", { p_id: 123, p_input: {} });
  // @ts-expect-error Generated argument names apply to the wrapper too.
  callDatabaseRpc(client, "save_article", { wrong_id: null, p_input: {} });
  // @ts-expect-error Required table fields are enforced on inserts.
  client.from("articles").insert({ id: "article-id" });
  // @ts-expect-error Updates cannot contain unknown columns.
  client.from("articles").update({ missing_column: true });
  // @ts-expect-error Status comes from the PostgreSQL enum.
  client.from("articles").update({ status: "missing_status" });
  // @ts-expect-error Only supported CHECK-constrained locales are accepted.
  client.from("article_translations").update({ locale: "fr" });
  // @ts-expect-error RPCs with no arguments reject arbitrary payloads.
  client.rpc("list_article_reviewers", { unexpected: true });

  client.rpc("save_article", { p_id: null, p_input: {} });
  client.rpc("change_article_state", { p_id: null, p_status: null });
  client.from("articles").select("content_version").then(({ data }) => {
    const version: number | undefined = data?.[0]?.content_version;
    // @ts-expect-error Unselected fields are not part of the inferred projection.
    void data?.[0]?.author_id;
    return version;
  });
  client.from("articles").select("missing_column").then(({ data }) => {
    // @ts-expect-error An invalid select produces a type error when consumed.
    const rows: Array<Pick<Tables<"articles">, "id">> = data ?? [];
    return rows;
  });
}

type IsAny<Value> = 0 extends (1 & Value) ? true : false;
type Assert<Value extends true> = Value;
export type DatabaseContractChecks = [
  Assert<IsAny<DatabaseClient> extends false ? true : false>,
  Assert<ReturnType<typeof createBrowserSupabaseClient> extends DatabaseClient ? true : false>,
  Assert<Awaited<ReturnType<typeof createServerSupabaseClient>> extends DatabaseClient ? true : false>,
  Assert<ReturnType<typeof createServiceRoleSupabaseClient> extends DatabaseClient ? true : false>,
  Assert<Database["public"]["Functions"]["save_article"]["Returns"] extends string ? true : false>,
];
