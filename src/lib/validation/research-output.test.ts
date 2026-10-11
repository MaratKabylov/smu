import { describe, expect, it } from "vitest";
import { researchOutputInputSchema, validateOutputFile, OUTPUT_FILE_MAX_BYTES } from "./research-output";
const id = "00000000-0000-4000-a000-000000000001";
const translation = { title: "Durable data", description: "A meaningful description of the scientific dataset." };
const input = { kind: "dataset", status: "draft", versionLabel: "v1", license: "CC BY", workIds: [id], files: [], ru: translation, kk: translation };
describe("output validation", () => {
  it("requires RU/KK, permits complete EN and rejects duplicates and unsafe links", () => {
    expect(researchOutputInputSchema.safeParse(input).success).toBe(true);
    expect(researchOutputInputSchema.safeParse({ ...input, en: translation }).success).toBe(true);
    for (const patch of [{ kk: undefined }, { en: { title: "English" } }, { workIds: [] }, { workIds: [id, id] },
      { files: [{ id, isPublic: true }, { id, isPublic: false }] }, { externalUrl: "javascript:alert(1)" }, { expectedVersion: 0 }]) {
      expect(researchOutputInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });
  it("matches PDF bytes, MIME and extension", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\ncontent");
    expect(validateOutputFile("report.pdf", "application/pdf", pdf)).toBe(true);
    expect(validateOutputFile("report.csv", "application/pdf", pdf)).toBe(false);
    expect(validateOutputFile("report.pdf", "application/pdf", new TextEncoder().encode("fake"))).toBe(false);
  });
  it("validates ZIP signatures and UTF-8 CSV rather than trusting browser MIME", () => {
    expect(validateOutputFile("source.zip", "application/zip", new Uint8Array([80, 75, 3, 4]))).toBe(true);
    expect(validateOutputFile("source.zip", "application/zip", new Uint8Array([80, 75, 5, 6]))).toBe(true);
    expect(validateOutputFile("source.zip", "application/zip", new Uint8Array([80, 75, 0, 0]))).toBe(false);
    expect(validateOutputFile("data.csv", "text/csv", new TextEncoder().encode("name,value\nҒылым,42"))).toBe(true);
    expect(validateOutputFile("data.csv", "text/csv", new Uint8Array([0xff]))).toBe(false);
    expect(validateOutputFile("data.csv", "text/csv", new Uint8Array([0]))).toBe(false);
  });
  it("rejects empty, oversized, unsafe-name and executable files", () => {
    for (const name of ["", "../data.csv", "bad\n.csv", "a".repeat(256) + ".csv"]) expect(validateOutputFile(name, "text/csv", new TextEncoder().encode("a,b"))).toBe(false);
    expect(validateOutputFile("empty.csv", "text/csv", new Uint8Array())).toBe(false);
    expect(validateOutputFile("large.csv", "text/csv", new Uint8Array(OUTPUT_FILE_MAX_BYTES + 1))).toBe(false);
    expect(validateOutputFile("program.exe", "application/octet-stream", new Uint8Array([77, 90]))).toBe(false);
  });
});
