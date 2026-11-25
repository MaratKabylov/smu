import { OpenDataUpdateAdminEditor } from "@/components/admin/open-data/OpenDataEditors";

export default async function EditOpenDataUpdatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpenDataUpdateAdminEditor id={id} />;
}
