import type { Locale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { scientistTaxonomyName } from "@/lib/i18n/scientist-taxonomy";
import type { PublicArticleDetail } from "@/types/domain/article";
import type { PublicScientistDetail } from "@/types/domain/scientist";
import { absoluteUrl, siteOrigin } from "./site";

export function organizationJsonLd(locale: Locale) {
  return { "@context": "https://schema.org", "@type": "Organization", "@id": siteOrigin() + "/#organization", name: getDictionary(locale).common.footer, url: absoluteUrl("/" + locale + "/journal") };
}
export function articleJsonLd(article: PublicArticleDetail) {
  const locale = article.translation.locale;
  const url = absoluteUrl("/" + locale + "/journal/" + encodeURIComponent(article.translation.slug));
  const authors = article.authors.filter(a => a.role === "author" || a.role === "coauthor").map(a => ({
    "@type": "Person", name: locale === "en" ? a.nameEn ?? a.nameRu : locale === "ru" ? a.nameRu : a.nameKk,
    ...(a.websiteUrl && /^https?:\/\//i.test(a.websiteUrl) ? { url: a.websiteUrl } : {}),
  }));
  return { "@context": "https://schema.org", "@type": "Article", "@id": url + "#article", url, mainEntityOfPage: url,
    headline: article.translation.title, description: article.translation.excerpt, inLanguage: locale,
    datePublished: article.publishedAt, ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    ...(article.cover ? { image: [article.cover.url] } : {}), ...(authors.length ? { author: authors } : {}),
    publisher: { "@type": "Organization", "@id": siteOrigin() + "/#organization", name: getDictionary(locale).common.footer },
  };
}
export function personJsonLd(person: PublicScientistDetail) {
  const locale = person.translation.locale;
  const url = absoluteUrl("/" + locale + "/scientists/" + encodeURIComponent(person.translation.slug));
  return { "@context": "https://schema.org", "@type": "Person", "@id": url + "#person", url,
    name: person.translation.fullName, description: person.translation.shortBio, jobTitle: person.translation.position,
    ...(person.avatarUrl ? { image: person.avatarUrl } : {}),
    ...(person.organization ? { affiliation: { "@type": "Organization", name: scientistTaxonomyName(person.organization, locale), ...(person.organization.websiteUrl ? { url: person.organization.websiteUrl } : {}) } } : {}),
    sameAs: [person.orcid ? "https://orcid.org/" + person.orcid : null, person.scholarUrl].filter(Boolean),
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
