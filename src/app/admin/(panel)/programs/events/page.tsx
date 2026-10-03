import { EventAdminList, type EventAdminSearch } from "@/components/events/EventAdmin";
export default function Page(props: { searchParams: EventAdminSearch }) {
  return <EventAdminList searchParams={props.searchParams} />;
}
