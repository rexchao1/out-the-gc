import { TripPlanner } from "@/components/trip-planner";

export default async function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripPlanner tripId={tripId} />;
}
