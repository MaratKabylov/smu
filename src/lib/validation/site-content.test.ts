import { expect, it } from "vitest";
import { contentHrefSchema, saveSiteContentSchema } from "./site-content";

it.each(["javascript:alert(1)", "//evil.example", "/\\evil.example", "https://user:pass@example.org", "https://example.org/\npath", "http://example.org"])("rejects unsafe content href %s", href => {
  expect(contentHrefSchema.safeParse(href).success).toBe(false);
});
it.each(["https://example.org/path?name=1#here", "/ru/support", "/kk/pages/about"])("accepts fixed content href %s", href => {
  expect(contentHrefSchema.parse(href)).toBe(href);
});
it("accepts all fixed setting types and rejects wrong value types and extra authority", () => {
  const input = { kind: "setting", key: "site_name", version: 0, data: { value: "SMU" } };
  expect(saveSiteContentSchema.safeParse(input).success).toBe(true);
  expect(saveSiteContentSchema.safeParse({ ...input, actor: "forged" }).success).toBe(false);
  for (const value of [null, 42, [], {}, " "]) expect(saveSiteContentSchema.safeParse({ ...input, data: { value } }).success).toBe(false);
  expect(saveSiteContentSchema.safeParse({ ...input, key: "social_links", data: { value: [{ label: "Science", href: "https://example.org" }] } }).success).toBe(true);
});
