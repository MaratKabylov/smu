import { ScienceWorkAdminEditor } from "@/components/science/ScienceWorkAdmin";
export default function Page(props: { searchParams: Promise<{ error?: string }> }) {
  return <ScienceWorkAdminEditor kind="project" searchParams={props.searchParams} />;
}
