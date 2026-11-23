import { ResearchOutputAdminEditor } from "@/components/science/ResearchOutputAdmin";

export default function Page(props: {
  searchParams: Promise<{ error?: string; created?: string; saved?: string }>;
}) {
  return <ResearchOutputAdminEditor searchParams={props.searchParams} />;
}
