import type { TripMemberRole } from "@prisma/client";
import prisma from "@/lib/prisma";

const rank: Record<TripMemberRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  OWNER: 2,
};

export async function getMembership(tripId: string, userId: string) {
  return prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
    include: { trip: true },
  });
}

export function canEdit(role: TripMemberRole) {
  return rank[role] >= rank.EDITOR;
}

export function canManageInvites(role: TripMemberRole) {
  return rank[role] >= rank.EDITOR;
}

export function isOwner(role: TripMemberRole) {
  return role === "OWNER";
}

export async function assertMember(tripId: string, userId: string) {
  const m = await getMembership(tripId, userId);
  if (!m) return { error: "not_found" as const };
  return { membership: m };
}

export async function assertEditor(tripId: string, userId: string) {
  const r = await assertMember(tripId, userId);
  if ("error" in r) return r;
  if (!canEdit(r.membership.role)) return { error: "forbidden" as const };
  return { membership: r.membership };
}

export async function assertOwner(tripId: string, userId: string) {
  const r = await assertMember(tripId, userId);
  if ("error" in r) return r;
  if (!isOwner(r.membership.role)) return { error: "forbidden" as const };
  return { membership: r.membership };
}
