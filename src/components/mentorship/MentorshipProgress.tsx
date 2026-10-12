import { accountStatus } from "@/lib/i18n/account-records";
import { mentorshipProgressCopy } from "@/lib/i18n/mentorship-progress";
import type { Locale } from "@/lib/i18n/locales";
import type { MentorshipProgress as Progress } from "@/lib/validation/mentorship";

export function MentorshipProgress({ locale, progress }: { locale: Locale; progress: Progress }) {
  const copy = mentorshipProgressCopy[locale];
  const relationStatuses: Record<string, string> = copy.statuses;
  const label = (scope: string, status: string) => scope === "relation" ? relationStatuses[status] ?? status
    : status === "withdrawn" ? copy.withdrawn : accountStatus(locale, status);
  return <section className="account-claim">
    <h2>{copy.title}</h2>
    {progress.relation && <p>{copy.kinds[progress.relation.kind]} · {copy.statuses[progress.relation.status]}</p>}
    <h3>{copy.history}</h3>
    {progress.historyTotal > progress.history.length && <p>{copy.recent} ({progress.historyTotal})</p>}
    <ol>{progress.history.map(item => <li key={item.id}>
      <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" }).format(new Date(item.createdAt))}</time>
      {" · "}{item.scope === "relation" ? copy.relation : copy.application}{" · "}
      {item.fromStatus && <>{label(item.scope, item.fromStatus)} → </>}{label(item.scope, item.toStatus)}
      {item.baseline && <> · {copy.baseline}</>}
    </li>)}</ol>
  </section>;
}
