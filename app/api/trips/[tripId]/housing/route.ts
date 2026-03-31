import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertEditor, assertMember } from "@/lib/trip-access";
import { z } from "zod";

const importSchema = z.object({
  provider: z.string().min(1),
  providerHotelId: z.string().min(1),
  name: z.string().min(1),
  nightlyCents: z.number().int().min(0).optional().nullable(),
  deepLinkUrl: z.string().url().optional(),
  metadataJson: z.record(z.string(), z.any()).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertMember(tripId, authd.userId);
  if ("error" in check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.housingCandidate.findMany({ where: { tripId }, orderBy: { name: "asc" } });
  return NextResponse.json({ housing: items });
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

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.housingCandidate.create({
    data: {
      tripId,
      provider: parsed.data.provider,
      providerHotelId: parsed.data.providerHotelId,
      name: parsed.data.name,
      nightlyCents: parsed.data.nightlyCents ?? undefined,
      deepLinkUrl: parsed.data.deepLinkUrl ?? undefined,
      metadataJson: parsed.data.metadataJson ?? undefined,
    },
  });

  return NextResponse.json({ housing: row }, { status: 201 });
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

  await prisma.housingCandidate.deleteMany({ where: { id, tripId } });
  return NextResponse.json({ ok: true });
}
