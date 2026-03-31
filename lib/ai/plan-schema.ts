import { z } from "zod";

/** LLM output: selection criteria only — prices and IDs come from APIs */
export const planCriteriaSchema = z.object({
  rationale: z.string().max(4000),
  preferredActivityCategories: z.array(z.string().min(1).max(64)).max(12),
  dailyThemes: z.array(z.string().max(200)).max(14).optional(),
  maxLegMinutes: z.number().int().min(5).max(240).optional(),
  hotelStyleHints: z.array(z.string().max(120)).max(8).optional(),
  flightOriginIata: z.string().length(3).optional(),
  notesForGroup: z.string().max(2000).optional(),
});

export type PlanCriteria = z.infer<typeof planCriteriaSchema>;

export const adjustmentSchema = z.object({
  summary: z.string().max(2000),
  suggestedSwaps: z
    .array(
      z.object({
        fromActivityPlaceId: z.string(),
        toActivityPlaceId: z.string(),
        reason: z.string().max(500),
      }),
    )
    .max(20),
});

export type AdjustmentPlan = z.infer<typeof adjustmentSchema>;
