import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertEditor, assertMember } from "@/lib/trip-access";
import { getPlaceDetails } from "@/lib/server/google/places";
import { z } from "zod";

const createSchema = z.object({
  placeId: z.string().min(1),
  category: z.string().min(1).max(64),
  name: z.string().max(500).optional(),
  dayIndex: z.number().int().min(0).max(30).optional().nullable(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertMember(tripId, authd.userId);
  if ("error" in check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.activityCandidate.findMany({
    where: { tripId },
    orderBy: [{ dayIndex: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ activities: items });
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  let details;
  try {
    details = await getPlaceDetails(parsed.data.placeId);
  } catch {
    details = {
      placeId: parsed.data.placeId,
      displayName: parsed.data.name ?? parsed.data.placeId,
    };
  }

  const estimatedCostCents =
    details.priceLevel === "PRICE_LEVEL_INEXPENSIVE"
      ? 1500
      : details.priceLevel === "PRICE_LEVEL_MODERATE"
        ? 3500
        : details.priceLevel === "PRICE_LEVEL_EXPENSIVE"
          ? 8000
          : 2500;

  const activity = await prisma.activityCandidate.create({
    data: {
      tripId,
      placeId: details.placeId,
      category: parsed.data.category,
      name: parsed.data.name ?? details.displayName ?? details.placeId,
      dayIndex: parsed.data.dayIndex ?? undefined,
      metadataJson: {
        formattedAddress: details.formattedAddress,
        rating: details.rating,
        priceLevel: details.priceLevel,
        lat: details.location?.lat,
        lng: details.location?.lng,
        googleMapsUri: details.googleMapsUri,
        websiteUri: details.websiteUri,
        estimatedCostCents,
      },
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertEditor(tripId, authd.userId);
  if ("error" in check) {
    const nf = await assertMember(tripId, authd.userId);
    if ("error" in nf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.activityCandidate.deleteMany({ where: { id, tripId } });
  return NextResponse.json({ ok: true });
}
