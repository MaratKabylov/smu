import { PublicOpportunityCatalog, opportunityCatalogMetadata, type OpportunityCatalogProps } from "@/components/opportunities/PublicOpportunities";
export function generateMetadata(props: OpportunityCatalogProps) { return opportunityCatalogMetadata(props); }
export default function Page(props: OpportunityCatalogProps) { return <PublicOpportunityCatalog {...props} />; }
