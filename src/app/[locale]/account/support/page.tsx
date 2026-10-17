import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SupportDetail, SupportList } from "@/components/support/SupportRecords";
import { supportCopy } from "@/lib/i18n/support-request";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { accountPageNumber, accountRecordIdSchema } from "@/lib/validation/account-records";
import { supportKindSchema, supportKinds } from "@/lib/validation/support-request";
import { getAccountAccess } from "@/server/services/account.service";
import { SupportRequestService } from "@/server/services/support-request.service";
export default async function Page({ params, searchParams }: { params: LocaleParams; searchParams: Promise<{ kind?: string; id?: string; page?: string }> }) {
  const locale = requireLocale((await params).locale); const query = await searchParams; const kind = supportKindSchema.safeParse(query.kind ?? "research_proposal");
  if (!kind.success || (query.id && !accountRecordIdSchema.safeParse(query.id).success)) notFound();
  const copy = supportCopy[locale]; const access = await getAccountAccess();
  if (access.state !== "allowed" && access.state !== "setup") redirect(`/${locale}/account/login`);
  const base = `/${locale}/account/support?kind=${kind.data}`;
  const shell = (children: React.ReactNode) => <section className="login-card account-card account-records-card"><Link href={`/${locale}/account`}>{copy.back}</Link><h1>{copy.own}</h1><nav className="account-links">{supportKinds.map(k => <Link key={k} href={`/${locale}/account/support?kind=${k}`} aria-current={k === kind.data ? "page" : undefined}>{copy.kinds[k]}</Link>)}</nav>{children}</section>;
  if (access.state === "setup") return shell(<p role="alert">{copy.unavailable}</p>);
  const page = accountPageNumber(query.page);
  let data;
  try { data = await new SupportRequestService().list(kind.data, false, page, query.id ?? null); }
  catch { return shell(<p role="alert">{copy.unavailable}</p>); }
  if (query.id && !data.items[0]) notFound();
  return shell(<><Link href={`/${locale}/support/${kind.data}`}>{copy.submit}</Link>{query.id ? <><Link href={base}>{copy.back}</Link><SupportDetail record={data.items[0]} locale={locale} /></> : <SupportList items={data.items} page={page} total={data.total} locale={locale} base={base} />}</>);
}
