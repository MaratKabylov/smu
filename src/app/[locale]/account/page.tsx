import Link from "next/link";
import { redirect } from "next/navigation";
import { accountCopy } from "@/lib/i18n/account";
import { requireLocale } from "@/lib/i18n/server";
import { getAccountAccess } from "@/server/services/account.service";
import { logoutAccount } from "@/server/actions/account.actions";
import type { AccountPageProps } from "@/components/account/AccountAuthPage";

export default async function AccountPage({ params, searchParams }: AccountPageProps) {
  const locale = requireLocale((await params).locale);
  const copy = accountCopy[locale];
  const access = await getAccountAccess();
  if (access.state === "setup") return <section className="login-card account-card"><h1>{copy.account}</h1><p role="status">{copy.setup}</p></section>;
  if (access.state !== "allowed") redirect(`/${locale}/account/login${access.state === "unconfirmed" ? "?error=unconfirmed" : ""}`);
  const { error } = await searchParams;
  return <section className="login-card account-card"><p className="login-kicker">{copy.profile}</p><h1>{copy.account}</h1>
    {access.displayName && <p>{access.displayName}</p>}<p>{access.email}</p><p className="account-notice">{copy.verified}</p>
    {error === "logout" && <div className="form-error" role="alert">{copy.messages.logout}</div>}
    <nav className="account-links" aria-label={copy.account}><Link href={`/${locale}/account/update-password`}>{copy["update-password"]}</Link>{access.admin && <Link href="/admin">{copy.admin}</Link>}</nav>
    <form action={logoutAccount.bind(null, locale)} className="login-form"><button type="submit">{copy.logout}</button></form>
  </section>;
}
