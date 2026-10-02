import { ScienceWorkAdminList } from "@/components/science/ScienceWorkAdmin";
export default function Page(props: { searchParams: Promise<{ q?: string; status?: string; deleted?: string; error?: string }> }) {
  return <ScienceWorkAdminList kind="project" searchParams={props.searchParams} />;
}
