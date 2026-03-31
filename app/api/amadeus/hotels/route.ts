import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { searchHotelsNear } from "@/lib/server/amadeus/hotels";

export async function GET(req: Request) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const adults = searchParams.get("adults") ? parseInt(searchParams.get("adults")!, 10) : 1;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !checkIn || !checkOut) {
    return NextResponse.json({ error: "lat, lng, checkIn, checkOut required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const offers = await searchHotelsNear({
      latitude: lat,
      longitude: lng,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: Number.isFinite(adults) ? adults : 1,
    });
    return NextResponse.json({ offers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hotel search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
