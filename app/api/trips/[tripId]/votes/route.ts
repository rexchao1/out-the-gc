import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertMember } from "@/lib/trip-access";
import { z } from "zod";

const voteSchema = z.object({
  dayIndex: z.number().int().min(0).max(30),
  activityCandidateId: z.string().min(1),
  score: z.number().int().min(1).max(5),
});

export async function GET(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertMember(tripId, authd.userId);
  if ("error" in check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const dayParam = searchParams.get("dayIndex");
  const dayParsed = dayParam != null ? parseInt(dayParam, 10) : NaN;
  const dayFilter = Number.isFinite(dayParsed) ? { dayIndex: dayParsed } : {};

  const votes = await prisma.vote.findMany({
    where: {
      tripId,
      ...dayFilter,
    },
    include: {
      activityCandidate: { select: { id: true, name: true, placeId: true, category: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const aggregate: Record<string, { sum: number; count: number; candidate: (typeof votes)[0]["activityCandidate"] }> = {};
  for (const v of votes) {
    const key = v.activityCandidateId;
    if (!aggregate[key]) {
      aggregate[key] = { sum: 0, count: 0, candidate: v.activityCandidate };
    }
    aggregate[key].sum += v.score;
    aggregate[key].count += 1;
  }

  const leaderboard = Object.values(aggregate)
    .map((a) => ({
      activityCandidateId: a.candidate.id,
      candidate: a.candidate,
      avgScore: a.count ? a.sum / a.count : 0,
      votes: a.count,
    }))
    .sort((x, y) => y.avgScore - x.avgScore);

  return NextResponse.json({ votes, leaderboard });
}

export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertMember(tripId, authd.userId);
  if ("error" in check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.activityCandidate.findFirst({
    where: { id: parsed.data.activityCandidateId, tripId },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Activity not in trip" }, { status: 400 });
  }

  const vote = await prisma.vote.upsert({
    where: {
      userId_tripId_dayIndex_activityCandidateId: {
        userId: authd.userId,
        tripId,
        dayIndex: parsed.data.dayIndex,
        activityCandidateId: parsed.data.activityCandidateId,
      },
    },
    create: {
      userId: authd.userId,
      tripId,
      dayIndex: parsed.data.dayIndex,
      activityCandidateId: parsed.data.activityCandidateId,
      score: parsed.data.score,
    },
    update: { score: parsed.data.score },
  });

  return NextResponse.json({ vote });
}
