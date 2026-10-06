import type { LocaleParams } from "@/lib/i18n/server";
import { PublicMentorshipCatalog, mentorshipCatalogMetadata, type MentorshipCatalogSearch } from "@/components/mentorship/PublicMentorship";
type Props = { params: LocaleParams; searchParams: MentorshipCatalogSearch };
export function generateMetadata({ params }: Props) { return mentorshipCatalogMetadata(params); }
export default function Page(props: Props) { return <PublicMentorshipCatalog {...props} />; }
