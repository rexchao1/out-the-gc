import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";

const DM_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? "";
}

export type MatrixElement = {
  originIndex: number;
  destinationIndex: number;
  durationSeconds?: number;
  distanceMeters?: number;
  status?: string;
};

function matrixCacheKey(origins: { lat: number; lng: number }[], destinations: { lat: number; lng: number }[], mode: string) {
  const raw = JSON.stringify({ origins, destinations, mode });
  return createHash("sha256").update(raw).digest("hex");
}

function modeParam(travelMode: string) {
  if (travelMode === "WALK") return "walking";
  if (travelMode === "BICYCLE") return "bicycling";
  if (travelMode === "TRANSIT") return "transit";
  return "driving";
}

/**
 * Travel durations between origin and destination points using Distance Matrix API (server key).
 * Falls back to haversine × speed when the key is missing or the request fails.
 */
export async function computeRouteMatrix(params: {
  origins: { lat: number; lng: number }[];
  destinations: { lat: number; lng: number }[];
  travelMode?: "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT";
}): Promise<MatrixElement[]> {
  const mode = params.travelMode ?? "DRIVE";
  const cacheKey = matrixCacheKey(params.origins, params.destinations, mode);

  const cached = await prisma.routesMatrixCache.findUnique({ where: { cacheKey } });
  if (cached) {
    const payload = cached.payload as { elements: MatrixElement[] };
    return payload.elements ?? [];
  }

  const key = apiKey();
  if (!key || params.origins.length === 0 || params.destinations.length === 0) {
    const elements = heuristicMatrix(params.origins, params.destinations, mode);
    await prisma.routesMatrixCache.upsert({
      where: { cacheKey },
      create: { cacheKey, payload: { elements } },
      update: { payload: { elements }, fetchedAt: new Date() },
    });
    return elements;
  }

  const originsStr = params.origins.map((o) => `${o.lat},${o.lng}`).join("|");
  const destStr = params.destinations.map((d) => `${d.lat},${d.lng}`).join("|");
  const url = new URL(DM_URL);
  url.searchParams.set("origins", originsStr);
  url.searchParams.set("destinations", destStr);
  url.searchParams.set("mode", modeParam(mode));
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const elements = heuristicMatrix(params.origins, params.destinations, mode);
    await prisma.routesMatrixCache.upsert({
      where: { cacheKey },
      create: { cacheKey, payload: { elements } },
      update: { payload: { elements }, fetchedAt: new Date() },
    });
    return elements;
  }

  const data = (await res.json()) as {
    status?: string;
    rows?: Array<{
      elements?: Array<{ status?: string; duration?: { value?: number }; distance?: { value?: number } }>;
    }>;
  };

  const elements: MatrixElement[] = [];
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return heuristicMatrix(params.origins, params.destinations, mode);
  }

  (data.rows ?? []).forEach((row, oi) => {
    (row.elements ?? []).forEach((el, di) => {
      elements.push({
        originIndex: oi,
        destinationIndex: di,
        durationSeconds: el.duration?.value,
        distanceMeters: el.distance?.value,
        status: el.status,
      });
    });
  });

  await prisma.routesMatrixCache.upsert({
    where: { cacheKey },
    create: { cacheKey, payload: { elements } },
    update: { payload: { elements }, fetchedAt: new Date() },
  });

  return elements;
}

function heuristicMatrix(
  origins: { lat: number; lng: number }[],
  destinations: { lat: number; lng: number }[],
  mode: string,
): MatrixElement[] {
  const speedKmh = mode === "WALK" ? 5 : mode === "BICYCLE" ? 15 : 35;
  const elements: MatrixElement[] = [];
  origins.forEach((o, oi) => {
    destinations.forEach((d, di) => {
      const km = haversineKm(o.lat, o.lng, d.lat, d.lng);
      const hours = km / speedKmh;
      elements.push({
        originIndex: oi,
        destinationIndex: di,
        durationSeconds: Math.round(hours * 3600),
        distanceMeters: Math.round(km * 1000),
        status: "HEURISTIC",
      });
    });
  });
  return elements;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
