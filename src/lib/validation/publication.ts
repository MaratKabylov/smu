import { z } from "zod";
import { publicationTypes } from "../../types/domain/publication";
export const publicationInputSchema = z.object({
  scientistId: z.uuid(), title: z.string().trim().min(3).max(500),
  year: z.coerce.number().int().min(1800).max(2200), journal: z.string().trim().min(2).max(240),
  doi: z.string().trim().max(300).refine(value => !value || /^10\.\d{4,9}\/\S+$/.test(value)).transform(value => value || null),
  url: z.union([z.literal(""), z.url().max(1000).refine(value => /^https?:\/\//i.test(value) && !/[\s\u0000-\u001f]/.test(value))]).transform(value => value || null),
  publicationType: z.enum(publicationTypes), status: z.enum(["draft", "published", "archived"]),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
});
export type PublicationInput = z.infer<typeof publicationInputSchema>;
