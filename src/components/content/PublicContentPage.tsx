import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import { locales } from "@/lib/i18n/locales";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { publicInformationPageKeys } from "@/lib/i18n/site-navigation";
import type { PublicSiteContent } from "@/lib/validation/site-content";

export function PublicContentPage({ content, locale }: { content: PublicSiteContent; locale: Locale }) {
  const page = content.page;
  if (!page) return null;
  const { settings } = content;
  const back = { ru: "На главную", kk: "Басты бетке", en: "Home" }[locale];
  const informationPage = publicInformationPageKeys.find(key => key === page.key);
  const languagePaths = Object.fromEntries(locales.map(language => [language, page.locales.includes(language) ? `/${language}/pages/${page.key}` : `/${language}`]));
  return <><PublicHeader locale={locale} section="journal" paths={languagePaths} contentPage siteName={settings.site_name} informationPage={informationPage} />
  <div className={`information-page information-${page.template}`}>
    <main className="information-main"><header><p className="page-kicker">{settings.site_name}</p><h1>{page.title}</h1>{page.summary && <p className="information-summary">{page.summary}</p>}</header>
      <div className="information-body">{page.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      {page.cta_href && <aside className="information-cta"><a className="primary-button" href={page.cta_href} rel="noreferrer">{page.cta_label}</a></aside>}
    </main>
    <footer className="information-footer"><Link href={`/${locale}`}>{back}</Link>{settings.contact_email && <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>}
      {settings.social_links.map((link, index) => <a href={link.href} rel="noreferrer" key={index}>{link.label}</a>)}
    </footer>
  </div></>;
}
