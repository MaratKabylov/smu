import { PublicResearchProgramDetail, researchProgramDetailMetadata, type ResearchProgramDetailParams } from "@/components/research-program/PublicResearchProgram";
export const revalidate = 300;
type Props = { params: ResearchProgramDetailParams };
export function generateMetadata({ params }: Props) { return researchProgramDetailMetadata(params); }
export default function Page(props: Props) { return <PublicResearchProgramDetail {...props} />; }
