import { EventAdminEditor, type EventAdminSearch } from "@/components/events/EventAdmin";
export default async function Page(props: { params: Promise<{ id: string }>; searchParams: EventAdminSearch }) {
  const { id } = await props.params;
  return <EventAdminEditor id={id} searchParams={props.searchParams} />;
}
