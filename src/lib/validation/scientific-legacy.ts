import { z } from "zod";

export const legacyKinds = ["topic", "archive", "unpublished_data", "dataset", "methodology", "collection", "unfinished_research", "scientific_school", "successor_topic"] as const;
export const legacyKindSchema = z.enum(legacyKinds);
export const legacyStatusSchema = z.enum(["draft", "published", "archived"]);
export const legacyUrlSchema = z.string().max(2000).refine(value => value === "" || /^https?:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^\s]*)?$/.test(value));
const translationSchema = z.object({ locale: z.enum(["ru", "kk", "en"]), title: z.string().trim().min(3).max(200), description: z.string().trim().min(20).max(20000) });
export const legacyInputSchema = z.object({
  id: z.uuid().nullable(), version: z.number().int().positive().nullable(), kind: legacyKindSchema, status: legacyStatusSchema,
  translations: z.array(translationSchema).min(2).max(3).refine(items => new Set(items.map(t => t.locale)).size === items.length && items.some(t => t.locale === "ru") && items.some(t => t.locale === "kk")),
  sourceText: z.string().max(100000), sourceUrl: legacyUrlSchema, rightsConfirmed: z.literal(true),
}).strict().refine(value => (value.id === null) === (value.version === null));
export type LegacyInput = z.infer<typeof legacyInputSchema>;
const publicItem = z.object({ id: z.uuid(), kind: legacyKindSchema, status: legacyStatusSchema, translations: z.array(translationSchema).min(1).max(3), sourceText: z.string().max(100000), sourceUrl: legacyUrlSchema });
export const legacyOwnerItemSchema = publicItem.extend({ version: z.number().int().positive(), sourceConsent: z.boolean(), consentAt: z.string().nullable() });
const page = { total: z.number().int().nonnegative(), page: z.number().int().min(1).max(100000), pageSize: z.literal(20) };
export const legacyPublicPageSchema = z.object({ ...page, items: z.array(publicItem).max(20) });
export const legacyOwnerPageSchema = z.object({ ...page, items: z.array(legacyOwnerItemSchema).max(20) });
export type LegacyPublicItem = z.infer<typeof publicItem>;
export type LegacyOwnerItem = z.infer<typeof legacyOwnerItemSchema>;

export function parseLegacyForm(id: string | null, version: number | null, form: FormData) {
  const translations = (["ru", "kk", "en"] as const).map(locale => ({ locale, title: form.get(`${locale}.title`) ?? "", description: form.get(`${locale}.description`) ?? "" })).filter(t => t.locale !== "en" || t.title !== "" || t.description !== "");
  return legacyInputSchema.safeParse({ id, version, kind: form.get("kind"), status: form.get("status"), translations, sourceText: form.get("sourceText"), sourceUrl: form.get("sourceUrl"), rightsConfirmed: form.get("rightsConfirmed") === "yes" });
}
