import { redirect } from "next/navigation";
import { Notifications } from "@/components/account/Notifications";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { accountPageNumber } from "@/lib/validation/account-records";
import { NotificationService } from "@/server/services/notification.service";

export default async function NotificationsPage({ params, searchParams }: { params: LocaleParams; searchParams: Promise<{ page?: string }> }) {
  const locale = requireLocale((await params).locale); const page = accountPageNumber((await searchParams).page);
  let data;
  try { data = await new NotificationService().list(page); }
  catch { redirect(`/${locale}/account/login`); }
  return <Notifications locale={locale} data={data} />;
}
