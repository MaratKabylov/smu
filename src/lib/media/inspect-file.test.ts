import { beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { inspectMediaFile } from "./inspect-file";
import { createMediaUploadSchema, DOCX_MIME, isMediaFileAllowed, mediaBucketRules } from "@/lib/validation/media";
import { mediaBuckets } from "@/types/domain/media";
let png: Buffer;
beforeAll(async () => { png = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } }).png().toBuffer(); });
function docx(parts: Record<string, string>) {
  const files: Buffer[] = [], entries: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(parts)) {
    const path = Buffer.from(name), data = Buffer.from(content), local = Buffer.alloc(30), entry = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(path.length, 26);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(path.length, 28); entry.writeUInt32LE(offset, 42);
    const file = Buffer.concat([local, path, data]); files.push(file); entries.push(Buffer.concat([entry, path])); offset += file.length;
  }
  const directory = Buffer.concat(entries), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, directory, end]);
}
const parts = { "[Content_Types].xml": '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" /></Types>', "word/document.xml": '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body /></w:document>' };
describe("purpose-specific byte inspection", () => {
  it("decodes a real image, derives dimensions and rejects truncated pixels and a false MIME", async () => {
    expect(await inspectMediaFile("avatars", "photo.png", "image/png", png)).toEqual({ width: 3, height: 2 });
    await expect(inspectMediaFile("avatars", "photo.jpg", "image/jpeg", png)).rejects.toThrow("invalid_file");
    await expect(inspectMediaFile("article-media", "photo.png", "image/png", png.subarray(0, 40))).rejects.toThrow("invalid_file");
    await expect(inspectMediaFile("article-media", "photo.png", "image/png", Buffer.from("<svg/>"))).rejects.toThrow("invalid_file");
  });
  it("checks PDF signatures and end markers, rejects header-only or HTML documents", async () => {
    expect(await inspectMediaFile("publication-files", "paper.pdf", "application/pdf", Buffer.from("%PDF-1.7\n...\n%%EOF\n"))).toEqual({ width: null, height: null });
    for (const body of ["%PDF-1.7", "<html>paper</html>"]) await expect(inspectMediaFile("documents", "paper.pdf", "application/pdf", Buffer.from(body))).rejects.toThrow("invalid_file");
  });
  it("validates UTF-8 CSV and rejects binary controls and invalid encodings", async () => {
    expect(await inspectMediaFile("research-files", "данные.csv", "text/csv", Buffer.from("field,значение\n1,Ғылым"))).toEqual({ width: null, height: null });
    for (const bytes of [Buffer.from([0xff, 0xfe]), Buffer.from([65, 0, 66])]) await expect(inspectMediaFile("research-files", "data.csv", "text/csv", bytes)).rejects.toThrow("invalid_file");
  });
  it("requires a DOCX package with both XML parts and refuses macros, traversal and generic renamed ZIP", async () => {
    expect(await inspectMediaFile("documents", "report.docx", DOCX_MIME, docx(parts))).toEqual({ width: null, height: null });
    for (const value of [docx({ "data.csv": "a,b" }), docx({ ...parts, "word/vbaProject.bin": "macro" }), docx({ ...parts, "../file": "unsafe" }), docx({ ...parts, "word/document.xml": "<!DOCTYPE unsafe><document />" })]) {
      await expect(inspectMediaFile("documents", "report.docx", DOCX_MIME, value)).rejects.toThrow("invalid_file");
    }
  });
  it("accepts opaque ZIP signatures, keeps archive contents unextracted and limits allowed destinations", async () => {
    expect(await inspectMediaFile("research-files", "data.zip", "application/zip", docx({ "data.csv": "a,b" }))).toEqual({ width: null, height: null });
    await expect(inspectMediaFile("publication-files", "data.zip", "application/zip", docx(parts))).rejects.toThrow("invalid_file");
  });
  it("checks MP4 top-level boxes and rejects malformed size or missing video structure", async () => {
    const box = (name: string, body: string) => { const value = Buffer.alloc(8 + body.length); value.writeUInt32BE(value.length); value.write(name, 4); value.write(body, 8); return value; };
    const bytes = Buffer.concat([box("ftyp", "isom0000"), box("moov", "movie"), box("mdat", "data")]);
    expect(await inspectMediaFile("event-media", "talk.mp4", "video/mp4", bytes)).toEqual({ width: null, height: null });
    await expect(inspectMediaFile("event-media", "talk.mp4", "video/mp4", bytes.subarray(0, 24))).rejects.toThrow("invalid_file");
  });
  it("enforces each bucket limit and MIME list with safe file names", () => {
    for (const bucket of mediaBuckets) {
      const rule = mediaBucketRules[bucket], mime = rule.mimeTypes[0];
      const name = mime.startsWith("image/") ? "file.jpg" : "file.pdf";
      expect(isMediaFileAllowed(bucket, name, mime, rule.maxBytes)).toBe(true);
      expect(isMediaFileAllowed(bucket, name, mime, rule.maxBytes + 1)).toBe(false);
      for (const bad of ["../file.pdf", "path\\file.pdf", "file\n.pdf", "", "file.svg"]) expect(isMediaFileAllowed(bucket, bad, mime, 1)).toBe(false);
    }
    expect(createMediaUploadSchema.safeParse({ bucket: "result-files", fileName: "paper.pdf", fileSize: 1, mimeType: "application/pdf" }).success).toBe(false);
  });
});
