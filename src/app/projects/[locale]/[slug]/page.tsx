import { PublicScienceWorkDetail, scienceDetailMetadata, type ScienceDetailParams } from "@/components/science/PublicScienceWork";
type Props = { params: ScienceDetailParams };
export function generateMetadata(props: Props) { return scienceDetailMetadata("project", props.params); }
export default function Page(props: Props) { return <PublicScienceWorkDetail kind="project" params={props.params} />; }
