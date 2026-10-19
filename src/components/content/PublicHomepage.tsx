import Link from "next/link";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { homeCopy, homeCatalogs, type Homepage } from "@/lib/homepage";
import type { Locale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { supportCopy } from "@/lib/i18n/support-request";

export function PublicHomepage({ data, locale }: { data: Homepage; locale: Locale }) {
  const copy = homeCopy[locale];
  return <>
    <PublicHeader locale={locale} section="journal" home siteName={data.settings.site_name} />
    <main className="homepage"><header className="homepage-heading"><p className="page-kicker">{getDictionary(locale).common.region}</p><h1>{data.settings.site_name}</h1></header>
      {data.sections.map(section => <section className={`homepage-section homepage-${section.key}`} key={section.key} aria-labelledby={`home-${section.key}`}>
        <div className="homepage-section-heading"><h2 id={`home-${section.key}`}>{section.title || copy.sections[section.key]}</h2>
          {homeCatalogs[section.key] && <Link href={`/${locale}/${homeCatalogs[section.key]}`}>{copy.all} →</Link>}</div>
        {section.key === "hero" ? <><p className="homepage-intro">{copy.intro}</p><div className="heading-actions"><Link className="primary-button" href={`/${locale}/scientists`}>{copy.sections.featured_scientists}</Link><Link className="secondary-button" href={`/${locale}/research`}>{copy.sections.featured_research}</Link></div></>
          : section.key === "scientist_support" ? <div className="homepage-cards">{(["research_proposal", "it_request", "publication_support"] as const).slice(0, section.display_limit).map(kind => <Link className="homepage-card" key={kind} href={`/${locale}/support/${kind}`}><h3>{supportCopy[locale].kinds[kind]}</h3></Link>)}</div>
          : section.items.length ? <div className="homepage-cards">{section.items.map(item => <Link className="homepage-card" href={item.href} key={item.id}><h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}</Link>)}</div>
          : <p className="homepage-empty">{copy.empty}</p>}
      </section>)}
    </main>
    <footer className="information-footer"><span>© {new Date().getFullYear()} {data.settings.site_name}</span>
      {data.settings.contact_email && <a href={`mailto:${data.settings.contact_email}`}>{data.settings.contact_email}</a>}
      {data.settings.social_links.map((link, i) => <a href={link.href} rel="noreferrer" key={i}>{link.label}</a>)}
    </footer>
  </>;
}
