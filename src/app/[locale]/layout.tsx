import type { Metadata } from "next";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "../globals.css";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const copy = getDictionary(locale).common;
  return {
    title: { default: `СМУ — ${copy.footer}`, template: "%s · СМУ" },
    description: locale === "ru" ? "Цифровая платформа научного сообщества Актюбинской области." : "Ақтөбе облысының ғылыми қауымдастығының цифрлық платформасы.",
  };
}

export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: LocaleParams }) {
  const locale = requireLocale((await params).locale);
  return <html lang={locale}><body>{children}</body></html>;
}
