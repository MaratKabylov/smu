import { expect, it } from "vitest";
import { legacyInputSchema, parseLegacyForm } from "./scientific-legacy";
import { legacyPublicPageSchema } from "./scientific-legacy";
import { legacyPublicUrl } from "@/lib/i18n/locales";
const input = { id: null, version: null, kind: "topic", status: "draft", translations: ["ru", "kk"].map(locale => ({ locale, title: "Research topic", description: "Description of a scientific topic." })), sourceText: "secret", sourceUrl: "", rightsConfirmed: true };
it("requires RU/KK, unique locales, bounded fields, ownership confirmation and matching id/version", () => {
  expect(legacyInputSchema.safeParse(input).success).toBe(true);
  for (const data of [{ ...input, rightsConfirmed: false }, { ...input, owner_id: crypto.randomUUID() }, { ...input, sourceConsent: true }, { ...input, version: 1 }, { ...input, sourceText: "x".repeat(100001) }, { ...input, translations: [input.translations[0], input.translations[0]] }]) expect(legacyInputSchema.safeParse(data).success).toBe(false);
});
it("rejects executable and credential URLs and accepts plain HTTP(S) archives", () => {
  for (const sourceUrl of ["javascript:alert(1)", "data:text/plain,secret", "//example.org", "https://user:pass@example.org", "https://example.org/\nsecret"]) expect(legacyInputSchema.safeParse({ ...input, sourceUrl }).success).toBe(false);
  expect(legacyInputSchema.safeParse({ ...input, sourceUrl: "https://example.org/archive.zip" }).success).toBe(true);
});
it("parses optional EN without allowing partial translations or implicit rights confirmation", () => {
  const form = new FormData(); form.set("kind", "archive"); form.set("status", "published"); form.set("sourceText", "secret"); form.set("sourceUrl", "");
  for (const t of input.translations) { form.set(`${t.locale}.title`, t.title); form.set(`${t.locale}.description`, t.description); }
  expect(parseLegacyForm(null, null, form).success).toBe(false); form.set("rightsConfirmed", "yes"); expect(parseLegacyForm(null, null, form).success).toBe(true);
  form.set("en.title", "English"); expect(parseLegacyForm(null, null, form).success).toBe(false);
});
it("strips private and unknown fields from the public DTO", () => {
  const data = legacyPublicPageSchema.parse({ page: 1, pageSize: 20, total: 1, items: [{ ...input, id: crypto.randomUUID(), owner_id: "secret", version: 1, sourceConsent: true, consentAt: "secret" }] });
  expect(data.items[0]).not.toHaveProperty("owner_id"); expect(data.items[0]).not.toHaveProperty("version"); expect(data.items[0]).not.toHaveProperty("consentAt");
});
it("redirects legacy heritage URLs with language and query parameters preserved", () => {
  expect(legacyPublicUrl(new URL("https://smu.example/mentorship/legacy?lang=kk&page=2"))?.href).toBe("https://smu.example/kk/mentorship/legacy?page=2");
});
