import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertEditor, canManageInvites, getMembership } from "@/lib/trip-access";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email().optional().nullable(),
  role: z.enum(["EDITOR", "VIEWER"]).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const m = await getMembership(tripId, authd.userId);
  if (!m || !canManageInvites(m.role)) {
    if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { tripId } = await ctx.params;

  const check = await assertEditor(tripId, authd.userId);
  if ("error" in check) {
    const m = await getMembership(tripId, authd.userId);
    if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt =
    parsed.data.expiresInDays != null
      ? new Date(Date.now() + parsed.data.expiresInDays * 86400000)
      : new Date(Date.now() + 14 * 86400000);

  const invite = await prisma.invite.create({
    data: {
      tripId,
      token,
      email: parsed.data.email ?? undefined,
      role: parsed.data.role ?? "EDITOR",
      expiresAt,
    },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const link = `${base.replace(/\/$/, "")}/invite/${invite.token}`;

  return NextResponse.json({ invite, link }, { status: 201 });
}
