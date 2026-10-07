export const locales = ["ru", "kk", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.some(locale => locale === value);
}

export const publicSections = ["journal", "scientists", "research", "projects", "publications", "mentorship", "research-program", "events"] as const;
export type PublicSection = (typeof publicSections)[number];

export function localizedPath(locale: Locale, path: string) {
  return `/${locale}${path === "/" ? "" : path}`;
}

export type PublicQuery = Record<string, string | string[] | undefined>;

export function appendPublicQuery(path: string, values: PublicQuery) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === "lang") continue;
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  return path + (query.size ? `?${query}` : "");
}

// Only known legacy public URLs are moved. Admin, API, assets and unknown
// routes must never be interpreted as public catalogues.
export function legacyPublicUrl(url: URL): URL | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const target = new URL(url);
  const section = parts[0];
  const requestedLocale = url.searchParams.get("lang");
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;
  if (parts.length === 0) {
    target.pathname = `/${locale}/journal`;
  } else if ((publicSections.some(item => item === section) || section === "search") && parts.length === 1) {
    target.pathname = `/${locale}/${section}`;
  } else if (publicSections.some(item => item === section) && parts.length === 3 && isLocale(parts[1])) {
    target.pathname = `/${parts[1]}/${section}/${parts[2]}`;
  } else {
    return null;
  }
  target.searchParams.delete("lang");
  return target;
}

export function languageSwitchPath(section: PublicSection, locale: Locale, query: URLSearchParams, paths?: Partial<Record<Locale, string>>) {
  const params = new URLSearchParams(query);
  params.delete("lang");
  const path = paths?.[locale] ?? localizedPath(locale, `/${section}`);
  return path + (params.size ? `?${params}` : "");
}

export function translationPaths(section: PublicSection, translations: readonly { locale: Locale; slug: string }[]) {
  return Object.fromEntries(translations.map(item => [item.locale, localizedPath(item.locale, `/${section}/${item.slug}`)])) as Partial<Record<Locale, string>>;
}

// Existing RPCs return legacy addresses. Normalize those at the application
// boundary while preserving the database's visibility/permission decisions.
export function canonicalPublicHref(href: string) {
  const origin = "https://smu.invalid";
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, origin);
  const target = legacyPublicUrl(url);
  return target ? target.pathname + target.search + target.hash : href;
}
