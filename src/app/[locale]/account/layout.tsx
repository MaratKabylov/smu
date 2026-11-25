import Link from "next/link";
import type { Metadata } from "next";
import { LogOut, ShieldCheck } from "lucide-react";
import { AccountSidebarNav } from "@/components/account/AccountSidebarNav";
import { InlinePublicHeader } from "@/components/i18n/PublicHeader";
import { accountCopy } from "@/lib/i18n/account";
import { locales } from "@/lib/i18n/locales";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { logoutAccount } from "@/server/actions/account.actions";
import { getAccountAccess } from "@/server/services/account.service";
import "./account.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function AccountLayout({ children, params }: { children: React.ReactNode; params: LocaleParams }) {
  const locale = requireLocale((await params).locale);
  const copy = accountCopy[locale];
  const access = await getAccountAccess();
  const allowed = access.state === "allowed";
  const shellCopy = {
    ru: { title: "Ваше научное пространство", text: "Профиль, проекты, статьи и заявки — в одном защищённом кабинете.", secure: "Защищённый доступ" },
    kk: { title: "Сіздің ғылыми кеңістігіңіз", text: "Профиль, жобалар, мақалалар және өтінімдер — бір қорғалған кабинетте.", secure: "Қорғалған қолжетімділік" },
    en: { title: "Your research workspace", text: "Your profile, projects, articles, and applications in one secure account.", secure: "Secure access" },
  }[locale];

  return <div className={`account-site ${allowed ? "is-authenticated" : "is-guest"}`}>
    <InlinePublicHeader locale={locale} section="scientists" contentPage siteName={copy.home} paths={Object.fromEntries(locales.map(language => [language, `/${language}/account`]))} />

    {allowed ? <div className="account-portal">
      <aside className="account-sidebar">
        <div className="account-sidebar-profile">
          <span className="account-avatar" aria-hidden="true">{(access.displayName || access.email).slice(0, 1).toUpperCase()}</span>
          <div><strong>{access.displayName || copy.profile}</strong><small>{access.email}</small></div>
        </div>
        <AccountSidebarNav locale={locale} />
        {access.admin && <Link className="account-admin-link" href="/admin"><ShieldCheck aria-hidden="true" />{copy.admin}</Link>}
        <form action={logoutAccount.bind(null, locale)} className="account-sidebar-logout"><button type="submit"><LogOut aria-hidden="true" />{copy.logout}</button></form>
      </aside>
      <main className="account-content">{children}</main>
    </div> : <main className="account-auth-shell">
      <section className="account-auth-intro">
        <p>{shellCopy.secure}</p><h1>{shellCopy.title}</h1><span>{shellCopy.text}</span>
        <div className="account-auth-orbit" aria-hidden="true"><i /><b /><em /></div>
      </section>
      <div className="account-auth-content">{children}</div>
    </main>}
  </div>;
}
