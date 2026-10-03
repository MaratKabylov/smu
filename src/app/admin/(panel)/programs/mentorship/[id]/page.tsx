import { MentorshipAdminEditor, type MentorshipAdminSearch } from "@/components/mentorship/MentorshipAdmin";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: MentorshipAdminSearch }) { const { id } = await params; return <MentorshipAdminEditor id={id} searchParams={searchParams} />; }
