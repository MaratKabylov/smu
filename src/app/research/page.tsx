import { PublicScienceWorkCatalog, scienceCatalogMetadata } from "@/components/science/PublicScienceWork";
type Props = { searchParams: Promise<{ lang?: string; q?: string; organization?: string; field?: string; stage?: string }> };
export function generateMetadata(props: Props) { return scienceCatalogMetadata("research", props.searchParams); }
export default function Page(props: Props) { return <PublicScienceWorkCatalog kind="research" searchParams={props.searchParams} />; }
