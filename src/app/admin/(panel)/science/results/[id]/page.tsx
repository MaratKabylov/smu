import { ResearchOutputAdminEditor } from "@/components/science/ResearchOutputAdmin";

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; created?: string }>;
}) {
  const { id } = await props.params;
  return <ResearchOutputAdminEditor id={id} searchParams={props.searchParams} />;
}
