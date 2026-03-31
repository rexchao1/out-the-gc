import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getPlaceDetails } from "@/lib/server/google/places";

export async function GET(_req: Request, ctx: { params: Promise<{ placeId: string }> }) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;
  const { placeId } = await ctx.params;
  if (!placeId) return NextResponse.json({ error: "Missing placeId" }, { status: 400 });

  try {
    const details = await getPlaceDetails(decodeURIComponent(placeId));
    return NextResponse.json({ details });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Details failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
