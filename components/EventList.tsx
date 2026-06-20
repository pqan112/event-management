import { IEvent } from "@/database";
import EventCard from "./EventCard";
import { cacheLife } from "next/cache";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

export default async function EventList() {
  "use cache";
  cacheLife("event");

  const response = await fetch(`${BASE_URL}/api/events`);
  const { events } = await response.json();

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
