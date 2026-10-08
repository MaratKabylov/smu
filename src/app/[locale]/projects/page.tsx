import type { LocaleParams } from "@/lib/i18n/server";
import { PublicScienceWorkCatalog, scienceCatalogMetadata } from "@/components/science/PublicScienceWork";
type Props = { params: LocaleParams; searchParams: Promise<{ lang?: string; q?: string; organization?: string; field?: string; stage?: string }> };
export function generateMetadata(props: Props) { return scienceCatalogMetadata("project", props.params, props.searchParams); }
export default function Page(props: Props) { return <PublicScienceWorkCatalog kind="project" searchParams={props.searchParams} params={props.params} />; }
