import { amadeusGet } from "@/lib/server/amadeus/client";

export type NormalizedFlightOffer = {
  provider: "amadeus";
  offerId: string;
  priceCents?: number;
  currency?: string;
  deepLinkUrl: string;
  segmentsJson: {
    slices: Array<{
      origin: string;
      destination: string;
      departure?: string;
      arrival?: string;
      carrier?: string;
      number?: string;
    }>;
  };
};

export async function searchFlights(params: {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  adults?: number;
  max?: number;
}): Promise<NormalizedFlightOffer[]> {
  const adults = params.adults ?? 1;
  const res = await amadeusGet("/v2/shopping/flight-offers", {
    originLocationCode: params.originLocationCode,
    destinationLocationCode: params.destinationLocationCode,
    departureDate: params.departureDate,
    adults,
    currencyCode: "USD",
    max: params.max ?? 5,
  });

  if (!res.ok || !res.data) {
    return mockFlights(params);
  }

  const data = res.data as {
    data?: Array<{
      id?: string;
      price?: { total?: string; currency?: string };
      itineraries?: Array<{
        segments?: Array<{
          departure?: { iataCode?: string; at?: string };
          arrival?: { iataCode?: string; at?: string };
          carrierCode?: string;
          number?: string;
        }>;
      }>;
    }>;
  };

  const out: NormalizedFlightOffer[] = [];
  for (const offer of data.data ?? []) {
    if (!offer.id) continue;
    const total = offer.price?.total ? parseFloat(offer.price.total) : undefined;
    const slices =
      offer.itineraries?.map((it) => {
        const seg = it.segments?.[0];
        return {
          origin: seg?.departure?.iataCode ?? "",
          destination: seg?.arrival?.iataCode ?? "",
          departure: seg?.departure?.at,
          arrival: seg?.arrival?.at,
          carrier: seg?.carrierCode,
          number: seg?.number,
        };
      }) ?? [];
    out.push({
      provider: "amadeus",
      offerId: offer.id,
      priceCents: total != null && !Number.isNaN(total) ? Math.round(total * 100) : undefined,
      currency: offer.price?.currency,
      deepLinkUrl: amadeusFlightDeepLink(offer.id),
      segmentsJson: { slices },
    });
  }

  return out.length ? out : mockFlights(params);
}

export function amadeusFlightDeepLink(offerId: string) {
  return `https://www.amadeus.com/flights?offerId=${encodeURIComponent(offerId)}`;
}

function mockFlights(params: {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
}): NormalizedFlightOffer[] {
  return [
    {
      provider: "amadeus",
      offerId: "MOCK_FLIGHT_1",
      priceCents: 32900,
      currency: "USD",
      deepLinkUrl: amadeusFlightDeepLink("MOCK_FLIGHT_1"),
      segmentsJson: {
        slices: [
          {
            origin: params.originLocationCode,
            destination: params.destinationLocationCode,
            departure: `${params.departureDate}T09:00:00`,
            arrival: `${params.departureDate}T12:30:00`,
            carrier: "XX",
            number: "100",
          },
        ],
      },
    },
  ];
}
