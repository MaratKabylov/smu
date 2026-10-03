import { ResearchProgramApplicationQueue, type ResearchProgramAdminSearch } from "@/components/research-program/ResearchProgramAdmin";
export default function Page({ searchParams }: { searchParams: ResearchProgramAdminSearch }) { return <ResearchProgramApplicationQueue searchParams={searchParams} />; }
