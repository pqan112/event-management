import { IEvent } from "@/database";
import EventCard from "./EventCard";
import { cacheLife } from "next/cache";
import { getEvents } from "@/lib/actions/event.actions";

export default async function EventList() {
  "use cache";
  cacheLife("event");

  const events = await getEvents();

  return (
    <ul className="events">
      {(events || []).map((event: IEvent) => (
        <li key={event.title} className="list-none">
          <EventCard {...event} />
        </li>
      ))}
    </ul>
  );
}
