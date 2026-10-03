import { ResearchProgramAdminEditor, type ResearchProgramAdminSearch } from "@/components/research-program/ResearchProgramAdmin";
export default function Page({ searchParams }: { searchParams: ResearchProgramAdminSearch }) { return <ResearchProgramAdminEditor searchParams={searchParams} />; }
