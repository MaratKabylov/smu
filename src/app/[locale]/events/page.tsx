import type { LocaleParams } from "@/lib/i18n/server";
import { PublicEventCatalog, eventCatalogMetadata, type EventCatalogSearch } from "@/components/events/PublicEvents";
type Props = { params: LocaleParams; searchParams: EventCatalogSearch };
export function generateMetadata(props: Props) { return eventCatalogMetadata(props.params); }
export default function Page(props: Props) { return <PublicEventCatalog searchParams={props.searchParams} params={props.params} />; }
