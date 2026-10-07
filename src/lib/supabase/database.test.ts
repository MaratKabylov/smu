import { describe, expect, it, vi } from "vitest";
import { callDatabaseRpc, databaseJson, requiredFields, type DatabaseClient } from "./database";

describe("database boundaries", () => {
  it("accepts JSON values and rejects unsupported wire payloads", () => {
    const value = { ru: { title: "Title", contentJson: { type: "doc", content: [] } }, en: null, tags: ["tag"], count: 0, enabled: false };
    expect(databaseJson(value)).toEqual(value);
    expect(databaseJson({ en: undefined, nested: { expectedVersion: undefined, title: "Title" } })).toEqual({ en: undefined, nested: { expectedVersion: undefined, title: "Title" } });
    for (const invalid of [undefined, { when: new Date() }, { value: NaN }, { callback: () => null }]) {
      expect(() => databaseJson(invalid)).toThrow();
    }
  });
  it("preserves nullable fields while requiring named RPC fields", () => {
    expect(requiredFields({ id: "id", title: null, total: 0 }, "id", "total")).toEqual({ id: "id", title: null, total: 0 });
    expect(() => requiredFields({ id: null }, "id")).toThrow("Missing database field: id");
    expect(() => requiredFields({ id: undefined }, "id")).toThrow("Missing database field: id");
  });
  it("preserves RPC arguments, results and database errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "article-id", error: null });
    const client = { rpc } as unknown as DatabaseClient;
    const args = { p_id: null, p_input: databaseJson({ title: "Title" }) };
    expect(await callDatabaseRpc(client, "save_article", args)).toBe("article-id");
    expect(rpc).toHaveBeenCalledWith("save_article", args);
    const error = { message: "forbidden", code: "42501" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(callDatabaseRpc(client, "save_article", args)).rejects.toBe(error);
  });
});
