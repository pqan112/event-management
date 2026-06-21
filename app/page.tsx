import { Suspense } from "react";
import ExploreBtn from "@/components/ExploreBtn";
import EventList from "@/components/EventList";

export default async function page() {
  return (
    <section>
      <h1 className="text-center">
        The Hub for Every Dev <br /> Event You Can't Miss
      </h1>
      <p className="text-center mt-5">
        Hackathons, Meetups, and Conferences, All in One Place
      </p>

      <ExploreBtn />

      <div className="mt-20 space-y-7">
        <h3>Featured Events</h3>
        <Suspense>
          <EventList />
        </Suspense>
      </div>
    </section>
  );
}
