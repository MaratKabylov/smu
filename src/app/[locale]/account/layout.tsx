import Link from "next/link";
import type { Metadata } from "next";
import { accountCopy } from "@/lib/i18n/account";
import { locales } from "@/lib/i18n/locales";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function AccountLayout({ children, params }: { children: React.ReactNode; params: LocaleParams }) {
  const locale = requireLocale((await params).locale);
  const copy = accountCopy[locale];
  return <main className="account-page">
    <header className="account-header"><Link href={`/${locale}/journal`}>СМУ · {copy.home}</Link>
      <nav aria-label={copy.languages}>{locales.map(language => <Link key={language} href={`/${language}/account`} hrefLang={language} aria-current={language === locale ? "page" : undefined}>{language.toUpperCase()}</Link>)}</nav>
    </header>{children}
  </main>;
}
