import type { LocaleParams } from "@/lib/i18n/server";
import { PublicResearchProgramCatalog, researchProgramCatalogMetadata, type ResearchProgramCatalogSearch } from "@/components/research-program/PublicResearchProgram";
type Props = { params: LocaleParams; searchParams: ResearchProgramCatalogSearch };
export function generateMetadata({ params }: Props) { return researchProgramCatalogMetadata(params); }
export default function Page(props: Props) { return <PublicResearchProgramCatalog {...props} />; }
