import Link from "next/link";
import { accountRecordsCopy, accountStatus } from "@/lib/i18n/account-records";
import type { Locale } from "@/lib/i18n/locales";
import type { AccountRecord, AccountRecordsPage, AccountSection } from "@/lib/validation/account-records";
import { RichTextContent } from "@/components/articles/RichTextContent";

export function AccountRecordsList({ locale, section, data }: { locale: Locale; section: AccountSection; data: AccountRecordsPage }) {
  const copy = accountRecordsCopy[locale];
  const base = `/${locale}/account/${section}`;
  return <>
    <p>{copy.total}: {data.total}</p>
    {!data.items.length && <p role="status">{copy.empty}</p>}
    <ul className="account-records-list">{data.items.map(item => <li key={`${item.kind}:${item.id}`}>
      <p className="account-record-meta">{copy.kinds[item.kind]} · {copy.relationships[item.relationship]} · {accountStatus(locale, item.status)}</p>
      <h2><Link href={`${base}/${item.id}`}>{item.title || copy.untitled}</Link></h2>
      {item.summary && <p>{item.summary}</p>}
      {item.locale && item.locale !== locale && <p>{copy.fallback}: {item.locale.toUpperCase()}</p>}
    </li>)}</ul>
    {(data.page > 1 || data.page * data.pageSize < data.total) && <nav className="account-links" aria-label={copy.sections[section]}>
      {data.page > 1 && <Link href={`${base}?page=${data.page - 1}`}>{copy.previous}</Link>}
      {data.page * data.pageSize < data.total && <Link href={`${base}?page=${data.page + 1}`}>{copy.next}</Link>}
    </nav>}
  </>;
}

export function AccountRecordDetail({ locale, record, editor }: { locale: Locale; record: AccountRecord; editor: string | null }) {
  const copy = accountRecordsCopy[locale];
  return <>
    <p className="account-record-meta">{copy.kinds[record.kind]} · {copy.relationships[record.relationship]} · {accountStatus(locale, record.status)}</p>
    <h1>{record.title || copy.untitled}</h1>
    {record.locale && record.locale !== locale && <p>{copy.fallback}: {record.locale.toUpperCase()}</p>}
    {record.summary && <p>{record.summary}</p>}
    {record.body && <div className="article-body account-record-body"><RichTextContent body={record.body} content={record.content} /></div>}
    {editor && <Link href={editor}>{copy.edit}</Link>}
  </>;
}
