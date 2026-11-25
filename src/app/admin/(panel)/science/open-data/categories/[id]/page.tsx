import { OpenDataCategoryAdminEditor } from "@/components/admin/open-data/OpenDataEditors";

export default async function EditOpenDataCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpenDataCategoryAdminEditor id={id} />;
}
