// Bound actual streamed bytes too: Content-Length is optional and untrusted.
export async function readBoundedJson(request: Request, limit = 8192): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(limit);
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (length + chunk.value.length > limit) { await reader.cancel(); return null; }
      bytes.set(chunk.value, length); length += chunk.value.length;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
  } catch { return null; }
  finally { reader.releaseLock(); }
}
