/* eslint-disable @next/next/no-img-element -- Supabase public URLs are configured at runtime. */
import { ArrowUpRight, Building2 } from "lucide-react";
import Link from "next/link";
import type { PublicScientistCard as ScientistCard, ScientistLocale } from "@/types/domain/scientist";

export function PublicScientistCard({ scientist, locale }: { scientist: ScientistCard; locale: ScientistLocale }) {
  const organizationName = scientist.organization
    ? locale === "ru" ? scientist.organization.nameRu : scientist.organization.nameKk
    : null;
  return <article className="scientist-card">
    <div className="scientist-card-photo">
      {scientist.avatarUrl ? <img src={scientist.avatarUrl} alt={scientist.translation.fullName} /> : <span>{initials(scientist.translation.fullName)}</span>}
    </div>
    <div className="scientist-card-content">
      <div className="scientist-card-fields">{scientist.fields.slice(0, 2).map((field) => <span key={field.id}>{locale === "ru" ? field.nameRu : field.nameKk}</span>)}</div>
      <h2><Link href={`/scientists/${locale}/${scientist.translation.slug}`}>{scientist.translation.fullName}</Link></h2>
      <p className="scientist-position">{scientist.translation.academicDegree ? `${scientist.translation.academicDegree} · ` : ""}{scientist.translation.position}</p>
      {organizationName ? <p className="scientist-organization"><Building2 aria-hidden="true" />{organizationName}</p> : null}
      <p className="scientist-bio">{scientist.translation.shortBio}</p>
      <Link className="scientist-more" href={`/scientists/${locale}/${scientist.translation.slug}`}>{locale === "ru" ? "Открыть профиль" : "Профильді ашу"}<ArrowUpRight aria-hidden="true" /></Link>
    </div>
  </article>;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
