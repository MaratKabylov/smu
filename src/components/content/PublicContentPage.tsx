import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import type { PublicSiteContent } from "@/lib/validation/site-content";

export function PublicContentPage({ content, locale }: { content: PublicSiteContent; locale: Locale }) {
  const page = content.page;
  if (!page) return null;
  const { settings } = content;
  const back = { ru: "На главную", kk: "Басты бетке", en: "Home" }[locale];
  return <div className={`information-page information-${page.template}`}>
    <header className="information-header"><Link href={`/${locale}`}>{settings.site_name}</Link><nav aria-label="Language">{page.locales.map(language => <Link href={`/${language}/pages/${page.key}`} hrefLang={language} aria-current={language === locale ? "page" : undefined} key={language}>{language.toUpperCase()}</Link>)}</nav></header>
    <main className="information-main"><header><p className="page-kicker">{settings.site_name}</p><h1>{page.title}</h1>{page.summary && <p className="information-summary">{page.summary}</p>}</header>
      <div className="information-body">{page.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      {page.cta_href && <aside className="information-cta"><a className="primary-button" href={page.cta_href} rel="noreferrer">{page.cta_label}</a></aside>}
    </main>
    <footer className="information-footer"><Link href={`/${locale}`}>{back}</Link>{settings.contact_email && <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>}
      {settings.social_links.map((link, index) => <a href={link.href} rel="noreferrer" key={index}>{link.label}</a>)}
    </footer>
  </div>;
}
