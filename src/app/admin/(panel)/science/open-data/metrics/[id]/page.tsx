import { OpenDataMetricAdminEditor } from "@/components/admin/open-data/OpenDataEditors";

export default async function EditOpenDataMetricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpenDataMetricAdminEditor id={id} />;
}
