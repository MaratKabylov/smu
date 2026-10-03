import { EventAdminEditor, type EventAdminSearch } from "@/components/events/EventAdmin";
export default function Page(props: { searchParams: EventAdminSearch }) {
  return <EventAdminEditor searchParams={props.searchParams} />;
}
