import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;

  const { token } = await ctx.params;
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId: invite.tripId, userId: authd.userId } },
    create: { tripId: invite.tripId, userId: authd.userId, role: invite.role },
    update: { role: invite.role },
  });

  return NextResponse.json({ ok: true, tripId: invite.tripId });
}
