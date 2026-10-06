import { redirect } from "next/navigation";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { appendPublicQuery, type PublicQuery } from "@/lib/i18n/locales";

export default async function Home({ params, searchParams }: { params: LocaleParams; searchParams: Promise<PublicQuery> }) {
  const locale = requireLocale((await params).locale);
  redirect(appendPublicQuery(`/${locale}/journal`, await searchParams));
}
