import { PublicOpportunityDetail, opportunityDetailMetadata, type OpportunityDetailProps } from "@/components/opportunities/PublicOpportunities";
export const revalidate = 300;
export function generateMetadata(props: OpportunityDetailProps) { return opportunityDetailMetadata(props); }
export default function Page(props: OpportunityDetailProps) { return <PublicOpportunityDetail {...props} />; }
