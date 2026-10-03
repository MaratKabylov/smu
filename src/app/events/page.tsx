import { PublicEventCatalog, eventCatalogMetadata, type EventCatalogSearch } from "@/components/events/PublicEvents";
type Props = { searchParams: EventCatalogSearch };
export function generateMetadata(props: Props) { return eventCatalogMetadata(props.searchParams); }
export default function Page(props: Props) { return <PublicEventCatalog searchParams={props.searchParams} />; }
