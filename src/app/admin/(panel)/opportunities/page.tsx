import { OpportunityAdminList, type OpportunityAdminSearch } from "@/components/opportunities/OpportunityAdmin";
export default function Page({ searchParams }: { searchParams: OpportunityAdminSearch }) { return <OpportunityAdminList searchParams={searchParams} />; }
