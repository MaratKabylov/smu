import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SupportManageForm } from "@/components/support/SupportForm";
import { SupportDetail, SupportList } from "@/components/support/SupportRecords";
import { supportCopy } from "@/lib/i18n/support-request";
import { accountPageNumber, accountRecordIdSchema } from "@/lib/validation/account-records";
import { supportKindSchema, supportPermissions, supportStatuses } from "@/lib/validation/support-request";
import { getAdminAccess } from "@/server/services/access.service";
import { SupportRequestService } from "@/server/services/support-request.service";
export default async function Page({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ status?: string; page?: string; id?: string }> }) {
  const kind = supportKindSchema.safeParse((await params).kind); const query = await searchParams;
  if (!kind.success || (query.id && !accountRecordIdSchema.safeParse(query.id).success)) notFound();
  const copy = supportCopy.ru; const access = await getAdminAccess();
  if (access.state === "unauthenticated") redirect("/admin/login");
  if (access.state !== "allowed" || !access.access.permissions.has(supportPermissions[kind.data])) return <p role="alert">Недостаточно прав для этой очереди.</p>;
  const status = supportStatuses.find(s => s === query.status) ?? "all"; const page = accountPageNumber(query.page);
  const base = `/admin/support/${kind.data}?status=${status}`;
  let data; let assignees;
  try {
    const service = new SupportRequestService();
    [data, assignees] = await Promise.all([service.list(kind.data, true, page, query.id ?? null, query.id ? "all" : status), query.id ? service.assignees(kind.data) : Promise.resolve([])]);
  } catch { return <p role="alert">{copy.unavailable}</p>; }
  if (query.id && !data.items[0]) notFound();
  return <section className="support-admin"><h1>{copy.queue}: {copy.kinds[kind.data]}</h1>{query.id ? <><Link href={base}>{copy.back}</Link><SupportDetail record={data.items[0]} locale="ru" manage /><SupportManageForm key={data.items[0].version} record={data.items[0]} assignees={assignees} /></> : <>
    <form className="account-links"><label>{copy.status}<select name="status" defaultValue={status}><option value="all">{copy.all}</option>{supportStatuses.map(s => <option key={s} value={s}>{copy.statuses[s]}</option>)}</select></label><button type="submit">{copy.filter}</button></form>
    <SupportList items={data.items} page={page} total={data.total} locale="ru" base={base} /></>}</section>;
}
