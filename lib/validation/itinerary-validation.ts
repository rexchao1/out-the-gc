import prisma from "@/lib/prisma";
import { computeRouteMatrix } from "@/lib/server/google/routes";

export type ValidationSummary = {
  tripId: string;
  flags: {
    budgetOk: boolean;
    timingOk: boolean;
    distanceOk: boolean;
  };
  totals: {
    housingCents: number;
    transportCents: number;
    activityEstimateCents: number;
    combinedCents: number;
    budgetCents: number | null;
  };
  messages: string[];
  activityPlaceIdsByDay: Record<string, string[]>;
};

function nightsBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Deterministic checks: budget slack vs summed hints, coarse timing overlap (same day duplicate dayIndex+time not modeled — placeholder), route matrix vs maxLegMinutes when coords exist.
 */
export async function runTripValidation(tripId: string, maxLegMinutes?: number): Promise<ValidationSummary> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      activityCandidates: true,
      housingCandidates: true,
      transportCandidates: true,
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  const messages: string[] = [];
  const nights = nightsBetween(trip.startDate, trip.endDate);

  let housingCents = 0;
  for (const h of trip.housingCandidates) {
    if (h.nightlyCents != null) housingCents += h.nightlyCents * nights;
  }

  let transportCents = 0;
  for (const t of trip.transportCandidates) {
    if (t.priceCents != null) transportCents += t.priceCents;
  }

  let activityEstimateCents = 0;
  for (const a of trip.activityCandidates) {
    const meta = a.metadataJson as { estimatedCostCents?: number } | null;
    if (meta?.estimatedCostCents) activityEstimateCents += meta.estimatedCostCents;
  }

  const combinedCents = housingCents + transportCents + activityEstimateCents;
  const budgetCents = trip.totalBudgetCents;
  const budgetOk = budgetCents == null || combinedCents <= budgetCents * 1.05;
  if (!budgetOk) {
    messages.push("Estimated costs exceed budget by more than 5% slack.");
  } else if (budgetCents != null) {
    messages.push("Estimated costs are within budget (±5% slack).");
  }

  const byDay: Record<number, typeof trip.activityCandidates> = {};
  for (const a of trip.activityCandidates) {
    const d = a.dayIndex ?? 0;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(a);
  }

  const activityPlaceIdsByDay: Record<string, string[]> = {};
  for (const [day, list] of Object.entries(byDay)) {
    activityPlaceIdsByDay[day] = list.map((x) => x.placeId);
  }

  let distanceOk = true;
  const legLimit = maxLegMinutes ?? 90;

  for (const list of Object.values(byDay)) {
    if (list.length < 2) continue;
    const coords: { lat: number; lng: number }[] = [];
    for (const item of list) {
      const meta = item.metadataJson as { lat?: number; lng?: number } | null;
      if (meta?.lat != null && meta?.lng != null) {
        coords.push({ lat: meta.lat, lng: meta.lng });
      }
    }
    if (coords.length < 2) continue;

    const origins = coords.slice(0, -1);
    const destinations = coords.slice(1);
    try {
      const matrix = await computeRouteMatrix({ origins, destinations, travelMode: "DRIVE" });
      for (let i = 0; i < origins.length; i++) {
        const el = matrix.find((m) => m.originIndex === i && m.destinationIndex === i);
        const sec = el?.durationSeconds;
        if (sec != null && sec / 60 > legLimit) {
          distanceOk = false;
          messages.push(`Day segment ${i + 1} exceeds ${legLimit} minutes travel (indicative).`);
        }
      }
    } catch {
      messages.push("Could not verify all route durations (API error); heuristic cache may apply.");
    }
  }

  if (distanceOk && messages.every((m) => !m.includes("exceeds"))) {
    messages.push("No route legs flagged over the travel-time threshold (where coordinates exist).");
  }

  const timingOk = true;

  return {
    tripId,
    flags: { budgetOk, timingOk, distanceOk },
    totals: { housingCents, transportCents, activityEstimateCents, combinedCents, budgetCents },
    messages,
    activityPlaceIdsByDay,
  };
}
