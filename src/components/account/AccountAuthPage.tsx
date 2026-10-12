import Link from "next/link";
import { redirect } from "next/navigation";
import { accountCopy } from "@/lib/i18n/account";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import type { AccountMode } from "@/lib/validation/account";
import { getAccountAccess } from "@/server/services/account.service";
import { AccountForm } from "./AccountForm";

export type AccountPageProps = { params: LocaleParams; searchParams: Promise<{ error?: string }> };

export async function AccountAuthPage({ params, searchParams, mode }: AccountPageProps & { mode: AccountMode }) {
  const locale = requireLocale((await params).locale);
  const copy = accountCopy[locale];
  const access = await getAccountAccess();
  if (access.state === "allowed" && (mode === "login" || mode === "register")) redirect(`/${locale}/account`);
  if (mode === "update-password" && access.state !== "allowed" && access.state !== "setup") redirect(`/${locale}/account/login?error=session`);
  const { error } = await searchParams;
  const notice = error === "confirm" || error === "unconfirmed" || error === "session" ? copy.messages[error] : null;
  const intro = mode === "login" ? copy.loginIntro : mode === "register" ? copy.registerIntro : mode === "recover" ? copy.recoverIntro : copy.updateIntro;
  return <section className="login-card account-card">
    <p className="login-kicker">{copy.account}</p><h1>{copy[mode]}</h1><p>{intro}</p>
    {notice && <div className="form-error" role="alert">{notice}</div>}
    {access.state === "setup" ? <p role="status">{copy.setup}</p> : <AccountForm locale={locale} mode={mode} />}
    <nav className="account-links" aria-label={copy.account}>
      {(["login", "register", "recover"] as const).filter(item => item !== mode).map(item => <Link key={item} href={`/${locale}/account/${item}`}>{copy[item]}</Link>)}
      {mode === "update-password" && <Link href={`/${locale}/account`}>{copy.account}</Link>}
    </nav>
  </section>;
}
