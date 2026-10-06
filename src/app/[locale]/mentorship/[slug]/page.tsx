import { PublicMentorshipDetail, mentorshipDetailMetadata, type MentorshipDetailParams } from "@/components/mentorship/PublicMentorship";
type Props = { params: MentorshipDetailParams };
export function generateMetadata({ params }: Props) { return mentorshipDetailMetadata(params); }
export default function Page(props: Props) { return <PublicMentorshipDetail {...props} />; }
