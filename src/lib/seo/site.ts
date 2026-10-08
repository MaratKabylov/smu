export function siteOrigin(): string {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) origin without credentials, path, query or fragment.");
  }
  return url.origin;
}

export function absoluteUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Expected a site-relative path.");
  const url = new URL(path, siteOrigin());
  if (url.origin !== siteOrigin()) throw new Error("Expected a same-origin path.");
  return url.href;
}
