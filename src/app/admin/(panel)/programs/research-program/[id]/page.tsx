import { ResearchProgramAdminEditor, type ResearchProgramAdminSearch } from "@/components/research-program/ResearchProgramAdmin";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ResearchProgramAdminSearch }) { const { id } = await params; return <ResearchProgramAdminEditor id={id} searchParams={searchParams} />; }
