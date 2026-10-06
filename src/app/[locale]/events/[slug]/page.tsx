import { PublicEventDetail, eventDetailMetadata, type EventDetailParams } from "@/components/events/PublicEvents";
type Props = { params: EventDetailParams };
export function generateMetadata(props: Props) { return eventDetailMetadata(props.params); }
export default function Page(props: Props) { return <PublicEventDetail params={props.params} />; }
