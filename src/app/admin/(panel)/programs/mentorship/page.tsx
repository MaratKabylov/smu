import { MentorshipAdminList, type MentorshipAdminSearch } from "@/components/mentorship/MentorshipAdmin";
export default function Page({ searchParams }: { searchParams: MentorshipAdminSearch }) { return <MentorshipAdminList searchParams={searchParams} />; }
