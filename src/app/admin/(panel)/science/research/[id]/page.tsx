import { ScienceWorkAdminEditor } from "@/components/science/ScienceWorkAdmin";
export default async function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; created?: string; status_changed?: string }> }) {
  const { id } = await props.params;
  return <ScienceWorkAdminEditor kind="research" id={id} searchParams={props.searchParams} />;
}
