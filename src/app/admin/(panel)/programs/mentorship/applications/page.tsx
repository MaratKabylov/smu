import { MentorshipApplicationQueue, type MentorshipAdminSearch } from "@/components/mentorship/MentorshipAdmin";
export default function Page({ searchParams }: { searchParams: MentorshipAdminSearch }) { return <MentorshipApplicationQueue searchParams={searchParams} />; }
