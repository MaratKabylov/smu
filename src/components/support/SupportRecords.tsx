import Link from "next/link";
import { supportCopy } from "@/lib/i18n/support-request";
import type { Locale } from "@/lib/i18n/locales";
import { supportFields, type SupportRecord } from "@/lib/validation/support-request";
export function SupportDetail({ record, locale, manage = false }: { record: SupportRecord; locale: Locale; manage?: boolean }) {
  const copy = supportCopy[locale];
  return <article className="support-detail"><p>{copy.status}: {copy.statuses[record.status]} · {record.createdAt.slice(0, 10)}</p>
    <h2 lang={record.locale}>{record.title}</h2><p lang={record.locale} className="support-text">{record.description}</p>
    <dl lang={record.locale}>{supportFields[record.kind].map(field => <div key={field}><dt>{copy.fields[field]}</dt><dd className="support-text">{record.details?.[field]}</dd></div>)}</dl>
    {manage && <dl><dt>{copy.contactName}</dt><dd>{record.contactName}</dd><dt>{copy.email}</dt><dd>{record.email}</dd><dt>{copy.organization}</dt><dd>{record.organization}</dd></dl>}
    <ul>{record.files?.map(file => <li key={file.id}><a href={`/api/support/${record.id}/files/${file.id}`} download>{file.name}</a> · {Math.ceil(file.size / 1024)} KiB</li>)}</ul>
  </article>;
}
export function SupportList({ items, locale, base, page, total }: { items: SupportRecord[]; locale: Locale; base: string; page: number; total: number }) {
  const copy = supportCopy[locale];
  return <>{!items.length && <p role="status">{copy.empty}</p>}<ul className="account-records-list">{items.map(record => <li key={record.id}><p>{copy.statuses[record.status]} · {record.updatedAt.slice(0, 10)}</p><h2><Link href={`${base}&id=${record.id}`} lang={record.locale}>{record.title}</Link></h2></li>)}</ul>
    <nav className="account-links" aria-label={copy.own}>{page > 1 && <Link href={`${base}&page=${page - 1}`}>{copy.previous}</Link>}{page * 20 < total && <Link href={`${base}&page=${page + 1}`}>{copy.next}</Link>}</nav></>;
}
