import { PublicResearchProgramCatalog, researchProgramCatalogMetadata, type ResearchProgramCatalogSearch } from "@/components/research-program/PublicResearchProgram";
type Props = { searchParams: ResearchProgramCatalogSearch };
export function generateMetadata({ searchParams }: Props) { return researchProgramCatalogMetadata(searchParams); }
export default function Page(props: Props) { return <PublicResearchProgramCatalog {...props} />; }
