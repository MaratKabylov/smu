import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/server/services/access.service";
import { canManageOpenData } from "@/lib/permissions/permissions";
import { OpenDataService } from "@/server/services/open-data.service";
import { OpenDataAdmin, type OpenDataAdminSearchState } from "@/components/admin/open-data/OpenDataAdmin";

type SearchParams = Promise<OpenDataAdminSearchState>;

export default async function AdminOpenDataPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const access = await getAdminAccess();
  if (access.state === "unauthenticated") redirect("/admin/login");
  if (access.state !== "allowed" || !canManageOpenData(access.access)) {
    notFound();
  }

  const state = (await searchParams) ?? {};
  const service = new OpenDataService();
  const data = await service.getAdminData(access.access);

  return (
    <OpenDataAdmin
      tab={state.tab}
      searchState={state}
      settings={data.settings}
      metrics={data.metrics}
      categories={data.categories}
      updates={data.updates}
    />
  );
}
