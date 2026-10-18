import { OpportunityAdminEditor, type OpportunityAdminSearch } from "@/components/opportunities/OpportunityAdmin";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: OpportunityAdminSearch }) { return <OpportunityAdminEditor id={(await params).id} searchParams={searchParams} />; }
