import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";

const PLACES_BASE = "https://places.googleapis.com/v1";

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? "";
}

export type PlaceSummary = {
  placeId: string;
  displayName?: string;
  formattedAddress?: string;
  location?: { lat: number; lng: number };
  types?: string[];
  rating?: number;
  priceLevel?: string;
};

function cacheKeyForSearch(textQuery: string, lat?: number, lng?: number, includedType?: string) {
  const raw = JSON.stringify({ textQuery, lat, lng, includedType });
  return createHash("sha256").update(raw).digest("hex");
}

export async function searchPlacesText(params: {
  textQuery: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  includedType?: string;
  skipCache?: boolean;
}): Promise<{ places: PlaceSummary[]; fromCache: boolean }> {
  const key = apiKey();
  const cacheKey = cacheKeyForSearch(
    params.textQuery,
    params.latitude,
    params.longitude,
    params.includedType,
  );

  if (!params.skipCache) {
    const cached = await prisma.placesSearchCache.findUnique({ where: { cacheKey } });
    if (cached) {
      const payload = cached.payload as { places: PlaceSummary[] };
      return { places: payload.places ?? [], fromCache: true };
    }
  }

  if (!key) {
    return {
      places: mockPlaces(params.textQuery, params.latitude, params.longitude),
      fromCache: false,
    };
  }

  const body: Record<string, unknown> = {
    textQuery: params.textQuery,
    maxResultCount: 15,
    languageCode: "en",
  };

  if (params.includedType) {
    body.includedType = params.includedType;
  }

  if (params.latitude != null && params.longitude != null) {
    body.locationBias = {
      circle: {
        center: { latitude: params.latitude, longitude: params.longitude },
        radius: params.radiusMeters ?? 15000,
      },
    };
  }

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.priceLevel",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Places search failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      types?: string[];
      rating?: number;
      priceLevel?: string;
    }>;
  };

  const places: PlaceSummary[] = (data.places ?? []).map((p) => ({
    placeId: (p.id ?? "").replace(/^places\//, ""),
    displayName: p.displayName?.text,
    formattedAddress: p.formattedAddress,
    location:
      p.location?.latitude != null && p.location?.longitude != null
        ? { lat: p.location.latitude, lng: p.location.longitude }
        : undefined,
    types: p.types,
    rating: p.rating,
    priceLevel: p.priceLevel,
  }));

  await prisma.placesSearchCache.upsert({
    where: { cacheKey },
    create: { cacheKey, payload: { places } as object },
    update: { payload: { places } as object, fetchedAt: new Date() },
  });

  return { places, fromCache: false };
}

function mockPlaces(q: string, lat?: number, lng?: number): PlaceSummary[] {
  const base = q.slice(0, 24) || "Activity";
  return [
    {
      placeId: `mock_${Buffer.from(base).toString("base64url").slice(0, 12)}_1`,
      displayName: `${base} — demo venue A`,
      formattedAddress: "Demo address (set GOOGLE_MAPS_API_KEY for live results)",
      location: lat != null && lng != null ? { lat: lat + 0.01, lng: lng + 0.01 } : undefined,
      types: ["point_of_interest"],
      rating: 4.2,
    },
    {
      placeId: `mock_${Buffer.from(base).toString("base64url").slice(0, 12)}_2`,
      displayName: `${base} — demo venue B`,
      formattedAddress: "Demo address (set GOOGLE_MAPS_API_KEY for live results)",
      location: lat != null && lng != null ? { lat: lat - 0.01, lng: lng - 0.015 } : undefined,
      types: ["restaurant"],
      rating: 4.5,
    },
  ];
}

export type PlaceDetails = PlaceSummary & {
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: unknown;
};

export async function getPlaceDetails(placeId: string, skipCache?: boolean): Promise<PlaceDetails> {
  const key = apiKey();
  const normalizedId = placeId.startsWith("places/") ? placeId : `places/${placeId}`;

  if (!skipCache) {
    const cached = await prisma.placeDetailCache.findUnique({ where: { placeId: normalizedId.replace(/^places\//, "") } });
    if (cached) {
      return cached.payload as PlaceDetails;
    }
  }

  if (!key) {
    return {
      placeId: placeId.replace(/^places\//, ""),
      displayName: "Demo place",
      formattedAddress: "Configure GOOGLE_MAPS_API_KEY for live details",
      types: ["point_of_interest"],
    };
  }

  const res = await fetch(`${PLACES_BASE}/${encodeURIComponent(normalizedId)}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,types,rating,priceLevel,nationalPhoneNumber,websiteUri,googleMapsUri,regularOpeningHours",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Place details failed: ${res.status} ${errText}`);
  }

  const p = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    types?: string[];
    rating?: number;
    priceLevel?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    regularOpeningHours?: unknown;
  };

  const idShort = (p.id ?? normalizedId).replace(/^places\//, "");
  const details: PlaceDetails = {
    placeId: idShort,
    displayName: p.displayName?.text,
    formattedAddress: p.formattedAddress,
    location:
      p.location?.latitude != null && p.location?.longitude != null
        ? { lat: p.location.latitude, lng: p.location.longitude }
        : undefined,
    types: p.types,
    rating: p.rating,
    priceLevel: p.priceLevel,
    nationalPhoneNumber: p.nationalPhoneNumber,
    websiteUri: p.websiteUri,
    googleMapsUri: p.googleMapsUri,
    regularOpeningHours: p.regularOpeningHours,
  };

  await prisma.placeDetailCache.upsert({
    where: { placeId: idShort },
    create: { placeId: idShort, payload: details as object },
    update: { payload: details as object, fetchedAt: new Date() },
  });

  return details;
}

/** Map UI category chips to Places (New) primary types where applicable */
export function categoryToIncludedType(category: string): string | undefined {
  const map: Record<string, string> = {
    eat: "restaurant",
    coffee: "cafe",
    sights: "tourist_attraction",
    museum: "museum",
    park: "park",
    shop: "shopping_mall",
    nightlife: "night_club",
  };
  return map[category.toLowerCase()];
}
