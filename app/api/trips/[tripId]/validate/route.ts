import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertEditor, assertMember } from "@/lib/trip-access";
import { runTripValidation } from "@/lib/validation/itinerary-validation";
import { suggestAdjustments } from "@/lib/ai/orchestrator";

export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertEditor(tripId, authd.userId);
  if ("error" in check) {
    const nf = await assertMember(tripId, authd.userId);
    if ("error" in nf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let maxLegMinutes: number | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.maxLegMinutes === "number") maxLegMinutes = body.maxLegMinutes;
  } catch {
    /* empty body ok */
  }

  const summary = await runTripValidation(tripId, maxLegMinutes);

  const allOk = summary.flags.budgetOk && summary.flags.distanceOk && summary.flags.timingOk;
  let adjustments = null as Awaited<ReturnType<typeof suggestAdjustments>> | null;
  if (!allOk) {
    adjustments = await suggestAdjustments(summary);
  }

  const run = await prisma.validationRun.create({
    data: {
      tripId,
      flagsJson: { ...summary.flags, adjustments: adjustments ?? undefined },
      aiNotes: adjustments?.summary ?? null,
    },
  });

  return NextResponse.json({ summary, adjustments, validationRunId: run.id });
}
