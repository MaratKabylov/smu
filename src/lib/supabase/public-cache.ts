// One dependency tag covers the connected public graph. A scientist change can
// also hide publications, programmes, article links and SEO URLs.
export const publicContentTag = "smu:public-content:v1";
export const publicCacheSeconds = 60;

const publicReadRpcs = new Set([
  "search_public", "seo_public_page", "seo_public_feed",
  "public_article_relations", "public_related_articles", "list_public_publications", "list_public_work_publications",
]);

export function createPublicFetch(origin: string, publicKey: string): typeof fetch {
  return (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers ?? request?.headers);
    const authorization = headers.get("authorization");
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    const anonymous = !headers.has("cookie") && (!authorization || authorization === "Bearer " + publicKey)
      && (!headers.has("apikey") || headers.get("apikey") === publicKey);
    const read = rpc ? publicReadRpcs.has(rpc) && (method === "GET" || method === "POST")
      : /^\/rest\/v1\/[^/]+$/.test(url.pathname) && method === "GET";
    const cacheable = url.origin === new URL(origin).origin && anonymous && read;
    return fetch(input, {
      ...init,
      cache: cacheable ? "force-cache" : "no-store",
      // Do not inherit caller cache settings for auth, writes or unknown RPCs.
      next: cacheable ? { revalidate: publicCacheSeconds, tags: [publicContentTag] } : { revalidate: 0 },
    });
  };
}
