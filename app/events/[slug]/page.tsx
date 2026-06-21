import EventDetails from "@/components/EventDetails";
import { Suspense } from "react";

const EventDetailsPage = ({ params }: PageProps<"/events/[slug]">) => {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <EventDetails params={params} />
      </Suspense>
    </main>
  );
};

export default EventDetailsPage;
