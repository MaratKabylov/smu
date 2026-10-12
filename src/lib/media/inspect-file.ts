import "server-only";
import sharp from "sharp";
import { inflateRawSync } from "node:zlib";
import { DOCX_MIME, isMediaFileAllowed } from "@/lib/validation/media";
import type { MediaBucket } from "@/types/domain/media";

// Validate the DOCX package without extracting files to disk. Only the two
// required XML parts are inflated, with a hard output cap on each.
function validateDocx(bytes: Buffer) {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0 || bytes.readUInt32LE(end + 4) !== 0) return false;
  const count = bytes.readUInt16LE(end + 10);
  if (!count || count > 2000 || count !== bytes.readUInt16LE(end + 8)) return false;
  let offset = bytes.readUInt32LE(end + 16);
  if (offset + bytes.readUInt32LE(end + 12) !== end) return false;
  const xml = new Map<string, string>();
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) return false;
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10);
    const size = bytes.readUInt32LE(offset + 20), rawSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const next = offset + 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    if (next > end || flags & 1 || ![0, 8].includes(method)) return false;
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (names.has(name) || /[\x00-\x1f\\]/.test(name) || name.startsWith("/") || name.split("/").includes("..") || /vbaProject|activeX/i.test(name)) return false;
    names.add(name);
    const local = bytes.readUInt32LE(offset + 42);
    if (local + 30 > offset || bytes.readUInt32LE(local) !== 0x04034b50) return false;
    const localNameLength = bytes.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
    if (start + size > offset || bytes.subarray(local + 30, local + 30 + localNameLength).toString("utf8") !== name) return false;
    if (name === "[Content_Types].xml" || name === "word/document.xml") {
      if (!rawSize || rawSize > 2 * 1024 * 1024) return false;
      const packed = bytes.subarray(start, start + size);
      const data = method === 8 ? inflateRawSync(packed, { maxOutputLength: 2 * 1024 * 1024 }) : packed;
      if (data.length !== rawSize) return false;
      const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
      if (/<!DOCTYPE|<!ENTITY/i.test(text)) return false;
      xml.set(name, text);
    }
    offset = next;
  }
  return offset === end && /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml/.test(xml.get("[Content_Types].xml") ?? "")
    && /<(?:\w+:)?document(?:\s|>)/.test(xml.get("word/document.xml") ?? "");
}

function validateMp4(bytes: Buffer) {
  let offset = 0, type = false, movie = false, data = false;
  while (offset + 8 <= bytes.length) {
    let size = bytes.readUInt32BE(offset);
    const name = bytes.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > bytes.length) return false;
      const large = bytes.readBigUInt64BE(offset + 8);
      if (large > BigInt(bytes.length)) return false;
      size = Number(large); header = 16;
    } else if (size === 0) size = bytes.length - offset;
    if (size < header || offset + size > bytes.length) return false;
    if (name === "ftyp") type = offset === 0 && size >= header + 8 && /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(bytes.toString("ascii", offset + header, offset + header + 4));
    if (name === "moov") movie = size > header;
    if (name === "mdat") data = size > header;
    offset += size;
  }
  return offset === bytes.length && type && movie && data;
}

export async function inspectMediaFile(bucket: MediaBucket, name: string, mime: string, bytes: Uint8Array) {
  if (!isMediaFileAllowed(bucket, name, mime, bytes.length)) throw new Error("invalid_file");
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (mime.startsWith("image/")) {
      const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (metadata.format !== mime.split("/")[1] || !metadata.width || !metadata.height) throw new Error();
      await image.stats(); // Decode pixels, so a header alone cannot pass.
      return { width: metadata.width, height: metadata.height };
    }
    let valid = false;
    if (mime === "application/pdf") valid = buffer.subarray(0, 5).toString() === "%PDF-" && /%%EOF\s*$/.test(buffer.subarray(-1024).toString());
    if (mime === "text/csv") valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    // Generic archives remain opaque; no extraction or antivirus claim.
    if (mime === "application/zip") valid = buffer.length >= 22 && [0x04034b50, 0x06054b50].includes(buffer.readUInt32LE(0));
    if (mime === DOCX_MIME) valid = validateDocx(buffer);
    if (mime === "video/mp4") valid = validateMp4(buffer);
    if (!valid) throw new Error();
    return { width: null, height: null };
  } catch { throw new Error("invalid_file"); }
}
