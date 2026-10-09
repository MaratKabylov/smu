import { z } from "zod";
import { publicationTypes } from "../../types/domain/publication";
export const publicationCoauthorSchema = z.object({
  scientistId: z.uuid().nullable(), name: z.string().trim().max(240).default(""),
  affiliation: z.string().trim().max(240).default(""),
}).strict().superRefine((author, ctx) => {
  if (author.scientistId ? author.name !== "" || author.affiliation !== "" : author.name.length < 2) {
    ctx.addIssue({ code: "custom", message: "Выберите профиль или укажите имя внешнего автора." });
  }
});
export const publicationInputSchema = z.object({
  scientistId: z.uuid(), title: z.string().trim().min(3).max(500),
  year: z.coerce.number().int().min(1800).max(2200), journal: z.string().trim().min(2).max(240),
  doi: z.string().trim().max(300).refine(value => !value || /^10\.\d{4,9}\/\S+$/.test(value)).transform(value => value || null),
  url: z.union([z.literal(""), z.url().max(1000).refine(value => /^https?:\/\//i.test(value) && !/[\s\u0000-\u001f]/.test(value))]).transform(value => value || null),
  publicationType: z.enum(publicationTypes), status: z.enum(["draft", "published", "archived"]),
  coauthors: z.array(publicationCoauthorSchema).max(30).default([]),
  workIds: z.array(z.uuid()).max(20).default([]),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
}).superRefine((input, ctx) => {
  const linked = input.coauthors.flatMap(author => author.scientistId ? [author.scientistId] : []);
  if (linked.includes(input.scientistId) || new Set(linked).size !== linked.length || new Set(input.workIds).size !== input.workIds.length) {
    ctx.addIssue({ code: "custom", message: "Связи не должны повторяться." });
  }
});
export type PublicationInput = z.infer<typeof publicationInputSchema>;
