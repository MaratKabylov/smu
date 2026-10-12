import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireLocale } from "@/lib/i18n/server";
import { accountRecordsCopy } from "@/lib/i18n/account-records";
import { accountPageNumber, accountSectionSchema } from "@/lib/validation/account-records";
import { getAccountAccess } from "@/server/services/account.service";
import { AccountRecordsError, AccountRecordsService } from "@/server/services/account-records.service";
import { AccountRecordsList } from "@/components/account/AccountRecords";
import { ClaimApplicationsForm } from "@/components/account/ClaimApplicationsForm";

export default async function AccountRecordsPage({ params, searchParams }: {
  params: Promise<{ locale: string; section: string }>; searchParams: Promise<{ page?: string | string[] }>;
}) {
  const route = await params;
  const locale = requireLocale(route.locale);
  const parsed = accountSectionSchema.safeParse(route.section);
  if (!parsed.success) notFound();
  const section = parsed.data;
  const copy = accountRecordsCopy[locale];
  const access = await getAccountAccess();
  if (access.state !== "allowed" && access.state !== "setup") redirect(`/${locale}/account/login${access.state === "unconfirmed" ? "?error=unconfirmed" : ""}`);
  let data = null;
  if (access.state === "allowed") {
    try { data = await new AccountRecordsService().list(locale, section, accountPageNumber((await searchParams).page)); }
    catch (error) { if (error instanceof AccountRecordsError && error.code === "session") redirect(`/${locale}/account/login`); }
  }
  return <section className="login-card account-card account-records-card">
    <Link href={`/${locale}/account`}>{copy.back}</Link><h1>{copy.sections[section]}</h1><p>{copy.intro}</p>
    {section === "applications" && access.state === "allowed" && <ClaimApplicationsForm locale={locale} />}
    {data ? <AccountRecordsList locale={locale} section={section} data={data} /> : <p role="alert">{copy.unavailable}</p>}
  </section>;
}
