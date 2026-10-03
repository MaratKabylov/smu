import { MentorshipAdminEditor, type MentorshipAdminSearch } from "@/components/mentorship/MentorshipAdmin";
export default function Page({ searchParams }: { searchParams: MentorshipAdminSearch }) { return <MentorshipAdminEditor searchParams={searchParams} />; }
