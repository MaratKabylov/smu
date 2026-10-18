import { OpportunityAdminEditor, type OpportunityAdminSearch } from "@/components/opportunities/OpportunityAdmin";
export default function Page({ searchParams }: { searchParams: OpportunityAdminSearch }) { return <OpportunityAdminEditor searchParams={searchParams} />; }
