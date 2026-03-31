import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { categoryToIncludedType, searchPlacesText } from "@/lib/server/google/places";
import { planCriteriaSchema, adjustmentSchema, type AdjustmentPlan, type PlanCriteria } from "@/lib/ai/plan-schema";
import type { ValidationSummary } from "@/lib/validation/itinerary-validation";

function client() {
  const key = process.env.OPENAI_API_KEY ?? "";
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function suggestPlanCriteria(params: {
  tripId: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  headcount: number;
  budgetCents: number | null;
  housingPrefs?: string | null;
}): Promise<{ criteria: PlanCriteria; groundedActivities: Awaited<ReturnType<typeof searchPlacesText>>["places"] }> {
  const openai = client();
  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    select: { destinationLat: true, destinationLng: true },
  });

  if (!openai) {
    const criteria = planCriteriaSchema.parse({
      rationale: "OpenAI key not configured — using default exploration mix.",
      preferredActivityCategories: ["eat", "sights", "park"],
      maxLegMinutes: 45,
      notesForGroup: "Add OPENAI_API_KEY for tailored suggestions.",
    });
    const { places } = await searchPlacesText({
      textQuery: `things to do in ${params.destination}`,
      latitude: trip?.destinationLat ?? undefined,
      longitude: trip?.destinationLng ?? undefined,
    });
    return { criteria, groundedActivities: places };
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You help plan group trips. Output ONLY JSON matching: rationale (string), preferredActivityCategories (string array of short tags like eat, sights, museum, park), dailyThemes (optional string array), maxLegMinutes (optional int), hotelStyleHints (optional string array), flightOriginIata (optional 3-letter), notesForGroup (optional). Never invent prices or flight numbers.",
      },
      {
        role: "user",
        content: JSON.stringify({
          destination: params.destination,
          startDate: params.startDate.toISOString(),
          endDate: params.endDate.toISOString(),
          headcount: params.headcount,
          budgetCents: params.budgetCents,
          housingPrefs: params.housingPrefs,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }

  const parsed = planCriteriaSchema.safeParse(json);
  const criteria = parsed.success
    ? parsed.data
    : planCriteriaSchema.parse({
        rationale: "Model output failed validation; using safe defaults.",
        preferredActivityCategories: ["eat", "sights"],
        notesForGroup: "Try again or adjust trip fields.",
      });

  const primary = criteria.preferredActivityCategories[0] ?? "sights";
  const includedType = categoryToIncludedType(primary);
  const { places } = await searchPlacesText({
    textQuery: `${primary} in ${params.destination}`,
    latitude: trip?.destinationLat ?? undefined,
    longitude: trip?.destinationLng ?? undefined,
    includedType,
  });

  return { criteria, groundedActivities: places };
}

export async function suggestAdjustments(summary: ValidationSummary): Promise<AdjustmentPlan> {
  const openai = client();
  if (!openai) {
    return adjustmentSchema.parse({
      summary: "Configure OPENAI_API_KEY for AI-suggested swaps. Review validation flags in the UI.",
      suggestedSwaps: [],
    });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Given validation flags and candidate activity placeIds, propose swaps using ONLY placeIds present in the input lists. JSON shape: summary (string), suggestedSwaps: [{ fromActivityPlaceId, toActivityPlaceId, reason }].",
      },
      {
        role: "user",
        content: JSON.stringify(summary),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }

  const parsed = adjustmentSchema.safeParse(json);
  if (parsed.success) return parsed.data;
  return adjustmentSchema.parse({
    summary: "Could not parse adjustment plan.",
    suggestedSwaps: [],
  });
}
