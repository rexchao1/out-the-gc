import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { searchFlights } from "@/lib/server/amadeus/flights";

export async function GET(req: Request) {
  const authd = await requireSession();
  if ("error" in authd) return authd.error;

  const { searchParams } = new URL(req.url);
  const origin = (searchParams.get("origin") ?? "").toUpperCase();
  const destination = (searchParams.get("destination") ?? "").toUpperCase();
  const departureDate = searchParams.get("departureDate") ?? "";
  const adults = searchParams.get("adults") ? parseInt(searchParams.get("adults")!, 10) : 1;

  if (origin.length !== 3 || destination.length !== 3 || !departureDate) {
    return NextResponse.json({ error: "origin, destination (IATA), departureDate required" }, { status: 400 });
  }

  try {
    const offers = await searchFlights({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      adults: Number.isFinite(adults) ? adults : 1,
    });
    return NextResponse.json({ offers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Flight search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
