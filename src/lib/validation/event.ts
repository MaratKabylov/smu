import { z } from "zod";
import { eventFormats, eventKinds, eventStatuses } from "../../types/domain/event";

const slug = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const translation = z.object({
  title: z.string().trim().min(3).max(240), slug,
  summary: z.string().trim().min(20).max(800),
  description: z.string().trim().min(40).max(30_000),
  organizer: z.string().trim().min(2).max(240),
  location: z.string().trim().max(500),
});
const nullableUrl = z.union([z.literal(""), z.url().max(1000).refine(value => /^https?:\/\//i.test(value))]).transform(value => value || null);
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine(value => z.iso.datetime({ local: true }).safeParse(value + ":00").success)
  .transform(value => new Date(value + ":00+05:00").toISOString());
export const eventStatusSchema = z.enum(eventStatuses);
export const eventInputSchema = z.object({
  kind: z.enum(eventKinds), format: z.enum(eventFormats),
  startsAt: dateTime, endsAt: dateTime,
  registrationDeadline: z.union([z.literal(""), dateTime]).transform(value => value || null),
  registrationUrl: nullableUrl, externalUrl: nullableUrl,
  coverMediaId: z.union([z.literal(""), z.uuid()]).transform(value => value || null),
  ru: translation, kk: translation, en: translation.optional(),
}).superRefine((value, context) => {
  if (value.endsAt <= value.startsAt)
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Окончание должно быть позже начала." });
  if (value.registrationDeadline && (value.registrationDeadline > value.startsAt || !value.registrationUrl))
    context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Укажите ссылку регистрации и дедлайн не позже начала." });
  if (value.format !== "online") for (const locale of ["ru", "kk"] as const) {
    if (value[locale].location.length < 3)
      context.addIssue({ code: "custom", path: [locale, "location"], message: "Укажите место проведения." });
  }
  if (value.format !== "offline" && !value.externalUrl)
    context.addIssue({ code: "custom", path: ["externalUrl"], message: "Укажите публичный сайт или ссылку трансляции." });
});
export const eventListFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  status: z.union([z.literal("all"), eventStatusSchema]).default("all"),
});
export const publicEventFiltersSchema = z.object({
  locale: z.enum(["ru", "kk", "en"]).default("ru"),
  query: z.string().trim().max(120).default(""),
  kind: z.union([z.literal("all"), z.enum(eventKinds)]).default("all"),
  format: z.union([z.literal("all"), z.enum(eventFormats)]).default("all"),
  period: z.enum(["upcoming", "past", "all"]).default("upcoming"),
});
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventListFilters = z.infer<typeof eventListFiltersSchema>;
export type PublicEventFilters = z.infer<typeof publicEventFiltersSchema>;
