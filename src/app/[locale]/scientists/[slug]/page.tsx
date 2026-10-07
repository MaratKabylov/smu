import { requireLocale } from "@/lib/i18n/server";
import { appendPublicQuery, type PublicQuery } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";
/* eslint-disable @next/next/no-img-element -- Supabase public URLs are configured at runtime. */
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Building2, Mail, Microscope } from "lucide-react";
import Link from "next/link";
import { ScientistPublications } from "@/components/science/PublicPublications";
import { RelatedArticles } from "@/components/articles/PublicArticleRelations";
import { notFound, permanentRedirect } from "next/navigation";
import { CommunityHeader } from "@/components/scientists/CommunityHeader";
import { getPublicScientistBySlug, PublicScientistService } from "@/server/services/scientist.service";
import type { ScientistLocale } from "@/types/domain/scientist";
import { scientistOrganizationCity, scientistTaxonomyName } from "@/lib/i18n/scientist-taxonomy";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<PublicQuery> };

function localeOrNotFound(value: string): ScientistLocale {
  return requireLocale(value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = localeOrNotFound(rawLocale);
  const scientist = await getPublicScientistBySlug(locale, slug);
  if (!scientist) return { title: locale === "ru" ? "Профиль не найден" : "Профиль табылмады" };
  return {
    title: scientist.translation.fullName,
    description: scientist.translation.shortBio,
    openGraph: {
      title: scientist.translation.fullName,
      description: scientist.translation.shortBio,
      images: scientist.avatarUrl ? [{ url: scientist.avatarUrl }] : undefined,
      type: "profile",
    },
  };
}

export default async function ScientistProfilePage({ params, searchParams }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = localeOrNotFound(rawLocale);
  const scientist = await getPublicScientistBySlug(locale, slug);
  if (!scientist) {
    const currentSlug = await new PublicScientistService().getSlugRedirect(locale, slug);
    if (currentSlug) permanentRedirect(appendPublicQuery(`/${locale}/scientists/${currentSlug}`, await searchParams));
    notFound();
  }
  const copy = getDictionary(locale).scientistProfile;
  const organizationName = scientist.organization
    ? scientistTaxonomyName(scientist.organization, locale)
    : null;
  const city = scientist.organization
    ? scientistOrganizationCity(scientist.organization, locale)
    : null;

  return <>
    <CommunityHeader locale={locale} translations={[scientist.translation, ...(scientist.alternateTranslation ? [scientist.alternateTranslation] : [])]} />
    <main className="scientist-profile-page">
      <div className="scientist-profile-shell">
        <nav className="public-breadcrumbs" aria-label={copy.breadcrumbs}><Link href={`/${locale}/scientists`}><ArrowLeft aria-hidden="true" />{copy.catalog}</Link><span>/</span><span>{scientist.translation.fullName}</span></nav>
        <section className="scientist-profile-hero">
          <div className="scientist-profile-photo">{scientist.avatarUrl ? <img src={scientist.avatarUrl} alt={scientist.translation.fullName} /> : <span>{initials(scientist.translation.fullName)}</span>}</div>
          <div className="scientist-profile-heading">
            <div className="scientist-profile-fields">{scientist.fields.map((field) => <Link href={`/${locale}/scientists?field=${field.slug}`} key={field.id}>{scientistTaxonomyName(field, locale)}</Link>)}</div>
            <h1>{scientist.translation.fullName}</h1>
            <p className="scientist-profile-position">{scientist.translation.academicDegree ? `${scientist.translation.academicDegree} · ` : ""}{scientist.translation.position}</p>
            {organizationName ? <p className="scientist-profile-org"><Building2 aria-hidden="true" /><span><strong>{organizationName}</strong>{city ? <small>{city}</small> : null}</span></p> : null}
            {scientist.alternateTranslation ? <Link className="profile-language-link" href={`/${scientist.alternateTranslation.locale}/scientists/${scientist.alternateTranslation.slug}`}>{scientist.alternateTranslation.locale === "ru" ? "Русская версия" : "Қазақша нұсқа"}</Link> : null}
          </div>
        </section>

        <div className="scientist-profile-layout">
          <article className="scientist-profile-biography">
            <p className="scientist-profile-lead">{scientist.translation.shortBio}</p>
            <h2>{copy.biography}</h2>
            {scientist.translation.biography.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </article>
          <aside className="scientist-profile-aside">
            <div className="profile-aside-heading"><Microscope aria-hidden="true" /><span><small>{copy.expertise}</small><strong>{scientist.fields.length}</strong></span></div>
            <div className="profile-expertise-list">{scientist.fields.map((field) => <span key={field.id}>{scientistTaxonomyName(field, locale)}</span>)}</div>
            {scientist.publicEmail ? <a href={`mailto:${scientist.publicEmail}`}><Mail aria-hidden="true" />{scientist.publicEmail}</a> : null}
            {scientist.orcid ? <a href={`https://orcid.org/${scientist.orcid}`} target="_blank" rel="noreferrer">ORCID {scientist.orcid}<ArrowUpRight aria-hidden="true" /></a> : null}
            {scientist.scholarUrl ? <a href={scientist.scholarUrl} target="_blank" rel="noreferrer">{copy.scientificProfile}<ArrowUpRight aria-hidden="true" /></a> : null}
            {scientist.organization?.websiteUrl ? <a href={scientist.organization.websiteUrl} target="_blank" rel="noreferrer">{copy.organizationSite}<ArrowUpRight aria-hidden="true" /></a> : null}
          </aside>
        </div>
        <ScientistPublications id={scientist.id} locale={locale} />
        <RelatedArticles kind="scientist" id={scientist.id} locale={locale} />
      </div>
    </main>
    <footer className="journal-footer"><span>© {new Date().getFullYear()} {getDictionary(locale).common.footer}</span><Link href={`/${locale}/scientists`}>{copy.catalog}</Link></footer>
  </>;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
