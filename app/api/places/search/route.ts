import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { categoryToIncludedType, searchPlacesText } from "@/lib/server/google/places";

export async function GET(req: Request) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const category = searchParams.get("category") ?? undefined;

  if (!q.trim()) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const latitude = lat != null ? parseFloat(lat) : undefined;
  const longitude = lng != null ? parseFloat(lng) : undefined;
  const includedType = category ? categoryToIncludedType(category) : undefined;

  try {
    const { places, fromCache } = await searchPlacesText({
      textQuery: q.trim(),
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      includedType,
    });
    return NextResponse.json({ places, fromCache });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
