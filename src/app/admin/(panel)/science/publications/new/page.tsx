import { PublicationAdminEditor } from "@/components/science/PublicationAdmin";

export default function Page(props: {
  searchParams: Promise<{ error?: string; created?: string; saved?: string }>;
}) {
  return <PublicationAdminEditor searchParams={props.searchParams} />;
}
