import Link from "next/link";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { supportCopy } from "@/lib/i18n/support-request";
import { locales } from "@/lib/i18n/locales";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { supportKinds } from "@/lib/validation/support-request";
export default async function Page({ params }: { params: LocaleParams }) {
  const locale = requireLocale((await params).locale); const copy = supportCopy[locale];
  return <><PublicHeader locale={locale} section="journal" paths={Object.fromEntries(locales.map(l => [l, `/${l}/support`]))} /><main className="support-page"><h1>{copy.title}</h1><p>{copy.intro}</p>
    <nav className="support-cards">{supportKinds.map(kind => <Link key={kind} href={`/${locale}/support/${kind}`}>{copy.kinds[kind]}</Link>)}</nav><Link href={`/${locale}/account/support`}>{copy.own}</Link></main></>;
}
