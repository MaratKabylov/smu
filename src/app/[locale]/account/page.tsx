import Link from "next/link";
import { redirect } from "next/navigation";
import { accountCopy } from "@/lib/i18n/account";
import { legacyCopy } from "@/lib/i18n/scientific-legacy";
import { supportCopy } from "@/lib/i18n/support-request";
import { accountRecordsCopy } from "@/lib/i18n/account-records";
import { accountSections } from "@/lib/validation/account-records";
import { requireLocale } from "@/lib/i18n/server";
import { getAccountAccess } from "@/server/services/account.service";
import type { AccountPageProps } from "@/components/account/AccountAuthPage";
import { notificationCopy } from "@/lib/i18n/notifications";
import { ArrowRight, Bell, BookOpenText, FileClock, FileText, FlaskConical, FolderKanban, Headphones, ShieldCheck, UserRound } from "lucide-react";

export default async function AccountPage({ params, searchParams }: AccountPageProps) {
  const locale = requireLocale((await params).locale);
  const copy = accountCopy[locale];
  const access = await getAccountAccess();
  if (access.state === "setup") return <section className="login-card account-card"><h1>{copy.account}</h1><p role="status">{copy.setup}</p></section>;
  if (access.state !== "allowed") redirect(`/${locale}/account/login${access.state === "unconfirmed" ? "?error=unconfirmed" : ""}`);
  const { error } = await searchParams;
  const sectionIcons = [UserRound, FileText, FolderKanban, FileClock, FlaskConical];
  return <section className="login-card account-card account-dashboard"><header className="account-dashboard-heading"><div><p className="login-kicker">{copy.profile}</p><h1>{copy.account}</h1>{access.displayName && <p className="account-dashboard-name">{access.displayName}</p>}<p className="account-dashboard-email">{access.email}</p></div><span className="account-verified-badge">{copy.verified}</span></header>
    {error === "logout" && <div className="form-error" role="alert">{copy.messages.logout}</div>}
    <nav className="account-sections" aria-label={copy.account}>{accountSections.map((section, index) => { const Icon = sectionIcons[index]; return <Link key={section} href={`/${locale}/account/${section}`}><span><Icon aria-hidden="true" /></span><strong>{accountRecordsCopy[locale].sections[section]}</strong><ArrowRight aria-hidden="true" /></Link>; })}<Link href={`/${locale}/account/legacy`}><span><BookOpenText aria-hidden="true" /></span><strong>{legacyCopy[locale].title}</strong><ArrowRight aria-hidden="true" /></Link><Link href={`/${locale}/account/support`}><span><Headphones aria-hidden="true" /></span><strong>{supportCopy[locale].own}</strong><ArrowRight aria-hidden="true" /></Link><Link href={`/${locale}/account/notifications`}><span><Bell aria-hidden="true" /></span><strong>{notificationCopy[locale].title}</strong><ArrowRight aria-hidden="true" /></Link></nav>
    {access.admin && <Link className="account-dashboard-admin" href="/admin"><ShieldCheck aria-hidden="true" />{copy.admin}</Link>}
  </section>;
}
