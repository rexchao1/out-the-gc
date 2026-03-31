import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  destination: z.string().min(1).max(500),
  destinationLat: z.number().optional(),
  destinationLng: z.number().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  headcount: z.number().int().min(1).max(100).optional(),
  totalBudgetCents: z.number().int().min(0).optional().nullable(),
  housingPrefsJson: z.string().optional().nullable(),
});

export async function GET() {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;

  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId: authd.userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { where: { userId: authd.userId }, take: 1 },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({ trips });
}

export async function POST(req: Request) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const trip = await prisma.trip.create({
    data: {
      name: d.name,
      destination: d.destination,
      destinationLat: d.destinationLat,
      destinationLng: d.destinationLng,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      headcount: d.headcount ?? 1,
      totalBudgetCents: d.totalBudgetCents ?? undefined,
      housingPrefsJson: d.housingPrefsJson ?? undefined,
      createdById: authd.userId,
      members: {
        create: { userId: authd.userId, role: "OWNER" },
      },
    },
  });

  return NextResponse.json({ trip }, { status: 201 });
}
