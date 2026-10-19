import Link from "next/link";
import { notificationCopy } from "@/lib/i18n/notifications";
import { locales, type Locale } from "@/lib/i18n/locales";
import type { NotificationPage } from "@/lib/validation/notifications";
import { markNotificationRead, setNotificationLocale } from "@/server/actions/notification.actions";

export function Notifications({ locale, data }: { locale: Locale; data: NotificationPage }) {
  const copy = notificationCopy[locale];
  return <section className="login-card account-card notifications-page">
    <h1>{copy.title}</h1><p>{copy.unread}: {data.unread}</p>
    <form action={setNotificationLocale.bind(null, locale)} className="notification-settings"><label>{copy.language}<select name="locale" defaultValue={locale}>{locales.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label><button type="submit">{copy.save}</button></form>
    {data.unread > 0 && <form action={markNotificationRead.bind(null, locale, null)}><button type="submit" className="secondary-button">{copy.all}</button></form>}
    {!data.items.length && <p role="status">{copy.empty}</p>}
    <ul className="notification-list">{data.items.map(item => <li key={item.id} className={item.readAt ? "is-read" : "is-unread"}>
      <p className="account-record-meta"><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qyzylorda" }).format(new Date(item.createdAt))}</time></p>
      <h2><Link href={item.url}>{item.title}</Link></h2><p>{item.message}</p>
      {!item.readAt && <form action={markNotificationRead.bind(null, locale, item.id)}><button type="submit" className="text-button">{copy.read}</button></form>}
    </li>)}</ul>
    <nav className="account-links" aria-label={copy.title}>{data.page > 1 && <Link href={`/${locale}/account/notifications?page=${data.page - 1}`}>{copy.previous}</Link>}{data.page * data.pageSize < data.total && <Link href={`/${locale}/account/notifications?page=${data.page + 1}`}>{copy.next}</Link>}</nav>
  </section>;
}
