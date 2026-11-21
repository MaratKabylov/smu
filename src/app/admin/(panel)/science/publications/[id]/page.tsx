import { PublicationAdminEditor } from "@/components/science/PublicationAdmin";

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; created?: string }>;
}) {
  const { id } = await props.params;
  return <PublicationAdminEditor id={id} searchParams={props.searchParams} />;
}
