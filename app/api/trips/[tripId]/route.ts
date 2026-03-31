import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertEditor, assertMember, assertOwner } from "@/lib/trip-access";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  destination: z.string().min(1).max(500).optional(),
  destinationLat: z.number().nullable().optional(),
  destinationLng: z.number().nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  headcount: z.number().int().min(1).max(100).optional(),
  totalBudgetCents: z.number().int().min(0).nullable().optional(),
  housingPrefsJson: z.string().nullable().optional(),
  planningStep: z.string().max(64).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertMember(tripId, authd.userId);
  if ("error" in check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      activityCandidates: { orderBy: { name: "asc" } },
      housingCandidates: true,
      transportCandidates: true,
      itineraryVersions: { orderBy: { createdAt: "desc" }, take: 5 },
      validationRuns: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ trip, role: check.membership.role });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      ...(d.name !== undefined && { name: d.name }),
      ...(d.destination !== undefined && { destination: d.destination }),
      ...(d.destinationLat !== undefined && { destinationLat: d.destinationLat }),
      ...(d.destinationLng !== undefined && { destinationLng: d.destinationLng }),
      ...(d.startDate !== undefined && { startDate: new Date(d.startDate) }),
      ...(d.endDate !== undefined && { endDate: new Date(d.endDate) }),
      ...(d.headcount !== undefined && { headcount: d.headcount }),
      ...(d.totalBudgetCents !== undefined && { totalBudgetCents: d.totalBudgetCents }),
      ...(d.housingPrefsJson !== undefined && { housingPrefsJson: d.housingPrefsJson }),
      ...(d.planningStep !== undefined && { planningStep: d.planningStep }),
    },
  });

  return NextResponse.json({ trip });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertOwner(tripId, authd.userId);
  if ("error" in check) {
    const nf = await assertMember(tripId, authd.userId);
    if ("error" in nf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Only the owner can delete this trip" }, { status: 403 });
  }

  await prisma.trip.delete({ where: { id: tripId } });
  return NextResponse.json({ ok: true });
}
