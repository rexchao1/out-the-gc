import { amadeusGet } from "@/lib/server/amadeus/client";

export type NormalizedHotelOffer = {
  provider: "amadeus";
  providerHotelId: string;
  name: string;
  nightlyCents?: number;
  currency?: string;
  deepLinkUrl: string;
  rawOfferId?: string;
  checkInDate?: string;
  checkOutDate?: string;
};

/**
 * Find hotels near a point, then fetch first-page offers when hotel IDs exist.
 * Deep links use Amadeus hotel search URL pattern; production should swap for partner-affiliate URLs when approved.
 */
export async function searchHotelsNear(params: {
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  radiusKm?: number;
}): Promise<NormalizedHotelOffer[]> {
  const adults = params.adults ?? 1;
  const radius = params.radiusKm ?? 50;

  const list = await amadeusGet("/v1/reference-data/locations/hotels/by-geocode", {
    latitude: params.latitude,
    longitude: params.longitude,
    radius: radius,
    radiusUnit: "KM",
  });

  if (!list.ok || !list.data) {
    return mockHotels(params);
  }

  const hotelsPayload = list.data as {
    data?: Array<{ hotelId?: string; name?: string; geoCode?: { latitude?: number; longitude?: number } }>;
  };

  const hotelIds = (hotelsPayload.data ?? [])
    .map((h) => h.hotelId)
    .filter((id): id is string => Boolean(id))
    .slice(0, 8);

  if (hotelIds.length === 0) {
    return mockHotels(params);
  }

  const offers = await amadeusGet("/v3/shopping/hotel-offers", {
    hotelIds: hotelIds.join(","),
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    adults,
    currency: "USD",
    bestRateOnly: "true",
  });

  if (!offers.ok || !offers.data) {
    return (hotelsPayload.data ?? []).slice(0, 6).map((h) => ({
      provider: "amadeus" as const,
      providerHotelId: h.hotelId ?? "unknown",
      name: h.name ?? "Hotel",
      deepLinkUrl: amadeusHotelDeepLink(h.hotelId ?? "", params.checkInDate, params.checkOutDate),
    }));
  }

  const offerData = offers.data as {
    data?: Array<{
      hotel?: { hotelId?: string; name?: string };
      offers?: Array<{
        id?: string;
        price?: { total?: string; currency?: string };
        checkInDate?: string;
        checkOutDate?: string;
      }>;
    }>;
  };

  const out: NormalizedHotelOffer[] = [];
  for (const block of offerData.data ?? []) {
    const hid = block.hotel?.hotelId;
    const name = block.hotel?.name ?? "Hotel";
    if (!hid) continue;
    const best = block.offers?.[0];
    const total = best?.price?.total ? parseFloat(best.price.total) : undefined;
    const nightly =
      total != null && !Number.isNaN(total) ? Math.round(total * 100) : undefined;
    out.push({
      provider: "amadeus",
      providerHotelId: hid,
      name,
      nightlyCents: nightly,
      currency: best?.price?.currency,
      rawOfferId: best?.id,
      checkInDate: best?.checkInDate ?? params.checkInDate,
      checkOutDate: best?.checkOutDate ?? params.checkOutDate,
      deepLinkUrl: amadeusHotelDeepLink(hid, params.checkInDate, params.checkOutDate),
    });
  }

  return out.length ? out : mockHotels(params);
}

export function amadeusHotelDeepLink(hotelId: string, checkIn: string, checkOut: string) {
  const q = new URLSearchParams({ checkInDate: checkIn, checkOutDate: checkOut, hotelId });
  return `https://www.amadeus.com/hotels?${q.toString()}`;
}

function mockHotels(params: { checkInDate: string; checkOutDate: string }): NormalizedHotelOffer[] {
  return [
    {
      provider: "amadeus",
      providerHotelId: "MOCK_STAY_A",
      name: "Demo hotel A (configure Amadeus keys for live inventory)",
      nightlyCents: 18900,
      currency: "USD",
      deepLinkUrl: amadeusHotelDeepLink("MOCK_STAY_A", params.checkInDate, params.checkOutDate),
    },
    {
      provider: "amadeus",
      providerHotelId: "MOCK_STAY_B",
      name: "Demo hotel B (configure Amadeus keys for live inventory)",
      nightlyCents: 14250,
      currency: "USD",
      deepLinkUrl: amadeusHotelDeepLink("MOCK_STAY_B", params.checkInDate, params.checkOutDate),
    },
  ];
}
