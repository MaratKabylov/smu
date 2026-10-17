import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireLocale } from "@/lib/i18n/server";
import { legacyCopy } from "@/lib/i18n/scientific-legacy";
import { accountPageNumber, accountRecordIdSchema } from "@/lib/validation/account-records";
import { ScientificLegacyError, ScientificLegacyService } from "@/server/services/scientific-legacy.service";
import { getAccountAccess } from "@/server/services/account.service";
import { LegacyConsentForm, LegacyForm } from "./LegacyForm";

export async function AccountLegacy({ params, searchParams, mode }: {
  params: Promise<{ locale: string; id?: string }>; searchParams?: Promise<{ page?: string | string[] }>; mode: "list" | "new" | "detail";
}) {
  const route = await params;
  const locale = requireLocale(route.locale);
  if (mode === "detail" && !accountRecordIdSchema.safeParse(route.id).success) notFound();
  const copy = legacyCopy[locale];
  const access = await getAccountAccess();
  if (access.state !== "allowed" && access.state !== "setup") redirect(`/${locale}/account/login${access.state === "unconfirmed" ? "?error=unconfirmed" : ""}`);
  const base = `/${locale}/account/legacy`;
  const shell = (content: React.ReactNode) => <section className="login-card account-card account-records-card"><Link href={mode === "list" ? `/${locale}/account` : base}>{copy.back}</Link><h1>{copy.title}</h1>{content}</section>;
  if (access.state === "setup") return shell(<p role="alert">{copy.unavailable}</p>);
  if (mode === "new") return shell(<LegacyForm locale={locale} />);
  const page = accountPageNumber((await searchParams)?.page);
  let data;
  try { data = await new ScientificLegacyService().own(locale, page, mode === "detail" ? route.id! : null); }
  catch (error) {
    if (error instanceof ScientificLegacyError && error.code === "session") redirect(`/${locale}/account/login`);
    return shell(<p role="alert">{copy.unavailable}</p>);
  }
  if (mode === "detail") {
    const record = data.items[0];
    if (!record) notFound();
    return shell(<><LegacyConsentForm key={`consent-${record.version}-${record.sourceConsent}`} locale={locale} record={record} /><LegacyForm key={record.version} locale={locale} record={record} /></>);
  }
  return shell(<><p>{copy.intro}</p><Link href={`${base}/new`}>{copy.create}</Link>
    {!data.items.length && <p role="status">{copy.empty}</p>}
    <ul className="account-records-list">{data.items.map(record => {
      const translation = record.translations.find(t => t.locale === locale) ?? record.translations.find(t => t.locale === "ru");
      return <li key={record.id}><p>{copy.kinds[record.kind]} · {copy.statuses[record.status]}</p><h2><Link href={`${base}/${record.id}`} lang={translation?.locale}>{translation?.title}</Link></h2>{translation && translation.locale !== locale && <p>{copy.fallback} {translation.locale.toUpperCase()}</p>}</li>;
    })}</ul>
    <nav className="account-links" aria-label={copy.title}>{page > 1 && <Link href={`${base}?page=${page - 1}`}>{copy.previous}</Link>}{page * 20 < data.total && <Link href={`${base}?page=${page + 1}`}>{copy.next}</Link>}</nav>
  </>);
}
