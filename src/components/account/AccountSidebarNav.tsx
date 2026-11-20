"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpenText,
  FileClock,
  FileText,
  FlaskConical,
  FolderKanban,
  Gauge,
  Headphones,
  KeyRound,
  UserRound,
} from "lucide-react";
import { accountCopy } from "@/lib/i18n/account";
import { accountRecordsCopy } from "@/lib/i18n/account-records";
import { notificationCopy } from "@/lib/i18n/notifications";
import { legacyCopy } from "@/lib/i18n/scientific-legacy";
import { supportCopy } from "@/lib/i18n/support-request";
import type { Locale } from "@/lib/i18n/locales";

export function AccountSidebarNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const account = accountCopy[locale];
  const records = accountRecordsCopy[locale];
  const base = `/${locale}/account`;
  const links = [
    { href: base, label: account.account, icon: Gauge, exact: true },
    { href: `${base}/scientist`, label: records.sections.scientist, icon: UserRound },
    { href: `${base}/articles`, label: records.sections.articles, icon: FileText },
    { href: `${base}/projects`, label: records.sections.projects, icon: FolderKanban },
    { href: `${base}/applications`, label: records.sections.applications, icon: FileClock },
    { href: `${base}/research-program`, label: records.sections["research-program"], icon: FlaskConical },
    { href: `${base}/legacy`, label: legacyCopy[locale].title, icon: BookOpenText },
    { href: `${base}/support`, label: supportCopy[locale].own, icon: Headphones },
    { href: `${base}/notifications`, label: notificationCopy[locale].title, icon: Bell },
    { href: `${base}/update-password`, label: account["update-password"], icon: KeyRound },
  ];

  return <nav className="account-sidebar-nav" aria-label={account.account}>
    {links.map(({ href, label, icon: Icon, exact }) => {
      const active = exact ? pathname === href : pathname.startsWith(href);
      return <Link href={href} key={href} aria-current={active ? "page" : undefined}>
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
