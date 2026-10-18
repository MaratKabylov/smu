import { PublicOpportunityDetail, opportunityDetailMetadata, type OpportunityDetailProps } from "@/components/opportunities/PublicOpportunities";
export function generateMetadata(props: OpportunityDetailProps) { return opportunityDetailMetadata(props); }
export default function Page(props: OpportunityDetailProps) { return <PublicOpportunityDetail {...props} />; }
