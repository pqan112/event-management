"use server";

import Event from "@/database/event.model";
import connectDB from "@/lib/mongodb";

export const getEvents = async () => {
  try {
    await connectDB();

    const events = await Event.find().sort({ createdAt: -1 }).lean();

    return JSON.parse(JSON.stringify(events));
  } catch {
    return [];
  }
};

export const getSimilarEventsBySlug = async (slug: string) => {
  try {
    await connectDB();
    const event = await Event.findOne({ slug });

    const similarEvents = await Event.find({
      _id: { $ne: event._id },
      tags: { $in: event.tags },
    }).lean();

    return JSON.parse(JSON.stringify(similarEvents));
  } catch {
    return [];
  }
};
