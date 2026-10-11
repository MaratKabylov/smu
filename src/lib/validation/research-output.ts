import { z } from "zod";
import { researchOutputKinds } from "@/types/domain/research-output";
const translation = z.object({ title: z.string().trim().min(3).max(240), description: z.string().trim().min(20).max(20_000) });
export const researchOutputInputSchema = z.object({
  kind: z.enum(researchOutputKinds), status: z.enum(["draft", "published", "archived"]),
  expectedVersion: z.coerce.number().int().positive().optional(),
  versionLabel: z.string().trim().min(1).max(80), license: z.string().trim().min(1).max(160),
  changeNote: z.string().trim().max(2000).default(""),
  externalUrl: z.union([z.literal(""), z.url().max(1000).refine(v => /^https?:\/\//i.test(v))]).default(""),
  workIds: z.array(z.uuid()).min(1).max(20).refine(v => new Set(v).size === v.length),
  files: z.array(z.object({ id: z.uuid(), isPublic: z.boolean() })).max(20).refine(v => new Set(v.map(f => f.id)).size === v.length),
  ru: translation, kk: translation, en: translation.optional(),
});
export type ResearchOutputInput = z.infer<typeof researchOutputInputSchema>;
export const publicResearchOutputSchema = z.object({
  id: z.uuid(), kind: z.enum(researchOutputKinds), version: z.number().int().positive(),
  versionLabel: z.string(), license: z.string(), title: z.string(), description: z.string(), externalUrl: z.string(),
  files: z.array(z.object({ id: z.uuid(), name: z.string(), size: z.number(), mimeType: z.string() })),
});
export type PublicResearchOutput = z.infer<typeof publicResearchOutputSchema>;
export const OUTPUT_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const outputFileMimeSchema = z.enum(["application/pdf", "text/csv", "application/zip"]);
export function validateOutputFile(name: string, mime: string, bytes: Uint8Array) {
  if (!name || name.length > 255 || /[\x00-\x1f/\\]/.test(name) || !bytes.length || bytes.length > OUTPUT_FILE_MAX_BYTES) return false;
  if (mime === "application/pdf") return /\.pdf$/i.test(name) && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  if (mime === "application/zip") return /\.zip$/i.test(name) && bytes[0] === 0x50 && bytes[1] === 0x4b && ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6));
  if (mime !== "text/csv" || !/\.csv$/i.test(name)) return false;
  try { return !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return false; }
}
