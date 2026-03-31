import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertEditor, assertMember } from "@/lib/trip-access";
import { suggestPlanCriteria } from "@/lib/ai/orchestrator";

export async function POST(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertEditor(tripId, authd.userId);
  if ("error" in check) {
    const nf = await assertMember(tripId, authd.userId);
    if ("error" in nf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await suggestPlanCriteria({
    tripId,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    headcount: trip.headcount,
    budgetCents: trip.totalBudgetCents,
    housingPrefs: trip.housingPrefsJson,
  });

  return NextResponse.json({
    criteria: result.criteria,
    groundedActivities: result.groundedActivities,
  });
}
