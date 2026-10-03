import { PublicMentorshipCatalog, mentorshipCatalogMetadata, type MentorshipCatalogSearch } from "@/components/mentorship/PublicMentorship";
type Props = { searchParams: MentorshipCatalogSearch };
export function generateMetadata({ searchParams }: Props) { return mentorshipCatalogMetadata(searchParams); }
export default function Page(props: Props) { return <PublicMentorshipCatalog {...props} />; }
