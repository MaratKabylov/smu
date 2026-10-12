import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireLocale } from "@/lib/i18n/server";
import { accountRecordsCopy } from "@/lib/i18n/account-records";
import { accountRecordIdSchema, accountSectionSchema } from "@/lib/validation/account-records";
import { getAccountAccess } from "@/server/services/account.service";
import { AccountRecordsError, AccountRecordsService } from "@/server/services/account-records.service";
import { AccountRecordDetail } from "@/components/account/AccountRecords";
import { MentorshipProgress } from "@/components/mentorship/MentorshipProgress";
import { WithdrawMentorshipForm } from "@/components/account/WithdrawMentorshipForm";
import { mentorshipProgressCopy } from "@/lib/i18n/mentorship-progress";
import type { MentorshipProgress as Progress } from "@/lib/validation/mentorship";

export default async function AccountRecordPage({ params }: { params: Promise<{ locale: string; section: string; id: string }> }) {
  const route = await params;
  const locale = requireLocale(route.locale);
  const parsed = accountSectionSchema.safeParse(route.section);
  if (!parsed.success || !accountRecordIdSchema.safeParse(route.id).success) notFound();
  const section = parsed.data;
  const copy = accountRecordsCopy[locale];
  const access = await getAccountAccess();
  if (access.state !== "allowed" && access.state !== "setup") redirect(`/${locale}/account/login${access.state === "unconfirmed" ? "?error=unconfirmed" : ""}`);
  let result = null;
  let failed = access.state === "setup";
  if (!failed) {
    try { result = await new AccountRecordsService().get(locale, section, route.id); }
    catch (error) {
      if (error instanceof AccountRecordsError && error.code === "session") redirect(`/${locale}/account/login`);
      failed = true;
    }
  }
  if (!failed && !result) notFound();
  let progress: Progress | null = null;
  let progressFailed = false;
  if (result?.record.kind === "mentorship_application") {
    try { progress = await new AccountRecordsService().mentorshipProgress(route.id); }
    catch (error) {
      if (error instanceof AccountRecordsError && error.code === "session") redirect(`/${locale}/account/login`);
      progressFailed = true;
    }
  }
  return <section className="login-card account-card account-records-card">
    <Link href={`/${locale}/account/${section}`}>{copy.backToList}</Link>
    {result ? <AccountRecordDetail locale={locale} {...result} /> : <p role="alert">{copy.unavailable}</p>}
    {progress && <MentorshipProgress locale={locale} progress={progress} />}
    {progressFailed && <p role="alert">{mentorshipProgressCopy[locale].unavailable}</p>}
    {progress && ["new", "in_review", "accepted"].includes(progress.applicationStatus) && <WithdrawMentorshipForm locale={locale} id={route.id} />}
  </section>;
}
