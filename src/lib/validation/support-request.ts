import { z } from "zod";
import { locales } from "@/lib/i18n/locales";
export const supportKinds = ["research_proposal", "it_request", "publication_support"] as const;
export const supportStatuses = ["new", "in_review", "in_progress", "completed", "rejected"] as const;
export const supportPriorities = ["low", "normal", "high"] as const;
export const supportKindSchema = z.enum(supportKinds);
export type SupportKind = z.infer<typeof supportKindSchema>;
export const supportFields = {
  research_proposal: ["importance", "region", "availableData"],
  it_request: ["currentProcess", "desiredSolution", "dataDescription"],
  publication_support: ["journal", "manuscriptStage", "supportNeeded"],
} as const;
export const supportPermissions = { research_proposal: "research_proposals.manage", it_request: "it_requests.manage", publication_support: "publication_support.manage" } as const;
const text = z.string().trim().min(2).max(5000);
const base = z.object({
  locale: z.enum(locales), title: z.string().trim().min(3).max(200), description: z.string().trim().min(20).max(20000),
  contactName: z.string().trim().min(2).max(160), email: z.string().trim().email().toLowerCase().max(254), organization: z.string().trim().max(200), consent: z.literal(true),
});
export const supportInputSchema = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("research_proposal"), details: z.object({ importance: text, region: text, availableData: text }) }),
  base.extend({ kind: z.literal("it_request"), details: z.object({ currentProcess: text, desiredSolution: text, dataDescription: text }) }),
  base.extend({ kind: z.literal("publication_support"), details: z.object({ journal: text, manuscriptStage: text, supportNeeded: text }) }),
]);
export type SupportInput = z.infer<typeof supportInputSchema>;
export const supportUpdateSchema = z.object({ id: z.uuid(), version: z.number().int().positive(), status: z.enum(supportStatuses), priority: z.enum(supportPriorities), assignedTo: z.uuid().nullable(), note: z.string().trim().max(5000) });
export type SupportUpdate = z.infer<typeof supportUpdateSchema>;
export const supportPageSchema = z.object({ total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.literal(20), items: z.array(z.object({
  id: z.uuid(), kind: supportKindSchema, locale: z.enum(locales), title: z.string(), status: z.enum(supportStatuses), createdAt: z.string(), updatedAt: z.string(),
  description: z.string().optional(), details: z.record(z.string(), z.string()).optional(), files: z.array(z.object({ id: z.uuid(), name: z.string(), size: z.number() })).optional(),
  version: z.number().int().positive().optional(), priority: z.enum(supportPriorities).optional(), assignedTo: z.uuid().nullable().optional(),
  contactName: z.string().optional(), email: z.string().optional(), organization: z.string().optional(), managerNote: z.string().optional(),
})) });
export type SupportRecord = z.infer<typeof supportPageSchema>["items"][number];
export const SUPPORT_FILE_MAX_BYTES = 1024 * 1024;
export function validSupportFile(file: { name: string; type: string }, bytes: Uint8Array) {
  return file.type === "application/pdf" && file.name.length <= 200 && !/[\x00-\x1f\x7f/\\]/.test(file.name) && /\.pdf$/i.test(file.name)
    && bytes.length > 5 && bytes.length <= SUPPORT_FILE_MAX_BYTES && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}
export function parseSupportForm(locale: unknown, kind: unknown, form: FormData) {
  if (!supportKindSchema.safeParse(kind).success || form.get("website")) return null;
  const selected = kind as SupportKind;
  const result = supportInputSchema.safeParse({ locale, kind, ...Object.fromEntries(["title", "description", "contactName", "email", "organization"].map(key => [key, form.get(key)])),
    consent: form.get("consent") === "yes", details: Object.fromEntries(supportFields[selected].map(key => [key, form.get(key)])) });
  return result.success ? result.data : null;
}
