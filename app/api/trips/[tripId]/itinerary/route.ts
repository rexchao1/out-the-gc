import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertEditor, assertMember, assertOwner } from "@/lib/trip-access";
import { z } from "zod";

const publishSchema = z.object({
  label: z.string().max(200).optional(),
  snapshot: z.record(z.string(), z.any()).optional(),
  applyFromVotes: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertMember(tripId, authd.userId);
  if ("error" in check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const active = await prisma.itineraryVersion.findFirst({
    where: { tripId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  const versions = await prisma.itineraryVersion.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ active, versions });
}

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  let snapshot: Prisma.InputJsonValue;

  if (parsed.data.applyFromVotes) {
    const ownerCheck = await assertOwner(tripId, authd.userId);
    if ("error" in ownerCheck) {
      return NextResponse.json({ error: "Only the owner can apply votes to the itinerary" }, { status: 403 });
    }

    const votes = await prisma.vote.groupBy({
      by: ["dayIndex", "activityCandidateId"],
      where: { tripId },
      _avg: { score: true },
      _count: { score: true },
    });

    const byDay: Record<number, { activityCandidateId: string; avg: number; n: number }[]> = {};
    for (const row of votes) {
      const avg = row._avg.score ?? 0;
      const n = row._count.score;
      if (!byDay[row.dayIndex]) byDay[row.dayIndex] = [];
      byDay[row.dayIndex].push({ activityCandidateId: row.activityCandidateId, avg, n });
    }

    const picks: Record<string, string | null> = {};
    for (const [day, list] of Object.entries(byDay)) {
      const best = [...list].sort((a, b) => b.avg - a.avg)[0];
      picks[day] = best?.activityCandidateId ?? null;
    }

    const activities = await prisma.activityCandidate.findMany({ where: { tripId } });
    snapshot = {
      generatedAt: new Date().toISOString(),
      source: "votes",
      picksByDay: picks,
      activities: activities.map((a) => ({
        id: a.id,
        placeId: a.placeId,
        name: a.name,
        dayIndex: a.dayIndex,
        metadataJson: a.metadataJson,
      })),
    };
  } else if (parsed.data.snapshot) {
    snapshot = parsed.data.snapshot as Prisma.InputJsonValue;
  } else {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        activityCandidates: true,
        housingCandidates: true,
        transportCandidates: true,
      },
    });
    if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
    snapshot = {
      generatedAt: new Date().toISOString(),
      source: "manual_publish",
      trip: {
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        headcount: trip.headcount,
        totalBudgetCents: trip.totalBudgetCents,
      },
      activities: trip.activityCandidates,
      housing: trip.housingCandidates,
      transport: trip.transportCandidates,
    };
  }

  await prisma.$transaction([
    prisma.itineraryVersion.updateMany({ where: { tripId, isActive: true }, data: { isActive: false } }),
    prisma.itineraryVersion.create({
      data: {
        tripId,
        label: parsed.data.label ?? `Version ${new Date().toISOString()}`,
        snapshot,
        isActive: true,
      },
    }),
  ]);

  const active = await prisma.itineraryVersion.findFirst({
    where: { tripId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ version: active }, { status: 201 });
}
