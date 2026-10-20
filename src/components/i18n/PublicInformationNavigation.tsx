import type { Locale } from "@/lib/i18n/locales";
import { publicInformationPageKeys, type PublicInformationPageKey } from "@/lib/i18n/site-navigation";
import { getPublicContentPaths } from "@/server/services/site-content.service";
import { PublicInformationMenu } from "./PublicInformationMenu";

export async function PublicInformationNavigation({ locale, current }: { locale: Locale; current?: PublicInformationPageKey }) {
  const paths = await getPublicContentPaths();
  const published = new Set(paths.filter(path => path.locale === locale).map(path => path.page_key));
  const pages = publicInformationPageKeys.filter(key => published.has(key));
  return <PublicInformationMenu locale={locale} pages={pages} current={current} />;
}
