"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToDisplay } from "@/lib/utils";

type TripPayload = {
  trip: {
    id: string;
    name: string;
    destination: string;
    destinationLat: number | null;
    destinationLng: number | null;
    startDate: string;
    endDate: string;
    headcount: number;
    totalBudgetCents: number | null;
    planningStep: string;
    activityCandidates: Array<{
      id: string;
      placeId: string;
      category: string;
      name: string | null;
      dayIndex: number | null;
      metadataJson: unknown;
    }>;
    housingCandidates: Array<{
      id: string;
      name: string | null;
      nightlyCents: number | null;
      deepLinkUrl: string | null;
      provider: string;
    }>;
    transportCandidates: Array<{
      id: string;
      mode: string;
      priceCents: number | null;
      segmentsJson: unknown;
    }>;
  };
  role: string;
};

const categories = ["eat", "sights", "museum", "park", "coffee", "nightlife", "shop"];

export function TripPlanner({ tripId }: { tripId: string }) {
  const [data, setData] = useState<TripPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(`/api/trips/${tripId}`);
    if (!res.ok) {
      setErr("Could not load trip");
      return;
    }
    const json = (await res.json()) as TripPayload;
    setData(json);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err || !data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-muted)]">{err ?? "Loading…"}</p>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
        <Link href="/trips" className="block text-sm text-[var(--color-accent)]">
          ← Trips
        </Link>
      </div>
    );
  }

  const { trip, role } = data;
  const canEdit = role === "OWNER" || role === "EDITOR";
  const isOwner = role === "OWNER";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/trips" className="text-sm text-[var(--color-muted)] hover:text-foreground">
            ← Trips
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{trip.name}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {trip.destination} · You are <strong>{role.toLowerCase()}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/trips/${tripId}/itinerary`}>Final itinerary</Link>
          </Button>
          {isOwner ? (
            <Button
              variant="destructive"
              type="button"
              onClick={async () => {
                if (!confirm("Delete this trip permanently?")) return;
                const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
                if (res.ok) window.location.href = "/trips";
              }}
            >
              Delete trip
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex flex-wrap gap-2 border-b border-black/10 pb-2">
          {["overview", "activities", "housing", "transport", "ai", "votes", "validate", "share"].map((v) => (
            <Tabs.Trigger
              key={v}
              value={v}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--color-muted)] data-[state=active]:bg-black/[0.06] data-[state=active]:text-foreground"
            >
              {v === "ai" ? "AI plan" : v}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview" className="pt-6">
          <OverviewTab trip={trip} canEdit={canEdit} onUpdated={load} tripId={tripId} />
        </Tabs.Content>
        <Tabs.Content value="activities" className="pt-6">
          <ActivitiesTab trip={trip} canEdit={canEdit} onUpdated={load} tripId={tripId} />
        </Tabs.Content>
        <Tabs.Content value="housing" className="pt-6">
          <HousingTab trip={trip} canEdit={canEdit} onUpdated={load} tripId={tripId} />
        </Tabs.Content>
        <Tabs.Content value="transport" className="pt-6">
          <TransportTab trip={trip} canEdit={canEdit} onUpdated={load} tripId={tripId} />
        </Tabs.Content>
        <Tabs.Content value="ai" className="pt-6">
          <AiTab tripId={tripId} canEdit={canEdit} onUpdated={load} />
        </Tabs.Content>
        <Tabs.Content value="votes" className="pt-6">
          <VotesTab trip={trip} tripId={tripId} onUpdated={load} />
        </Tabs.Content>
        <Tabs.Content value="validate" className="pt-6">
          <ValidateTab tripId={tripId} canEdit={canEdit} />
        </Tabs.Content>
        <Tabs.Content value="share" className="pt-6">
          <ShareTab tripId={tripId} canEdit={canEdit} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function OverviewTab({
  trip,
  canEdit,
  onUpdated,
  tripId,
}: {
  trip: TripPayload["trip"];
  canEdit: boolean;
  onUpdated: () => void;
  tripId: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Dates, headcount, budget used by validation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-[var(--color-muted)]">Dates: </span>
            {new Date(trip.startDate).toLocaleDateString()} — {new Date(trip.endDate).toLocaleDateString()}
          </p>
          <p>
            <span className="text-[var(--color-muted)]">Headcount: </span>
            {trip.headcount}
          </p>
          <p>
            <span className="text-[var(--color-muted)]">Budget: </span>
            {centsToDisplay(trip.totalBudgetCents)}
          </p>
          <p>
            <span className="text-[var(--color-muted)]">Planning step: </span>
            {trip.planningStep}
          </p>
        </CardContent>
      </Card>
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Update step</CardTitle>
            <CardDescription>Track where the group is in the flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const planningStep = String(fd.get("planningStep"));
                await fetch(`/api/trips/${tripId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ planningStep }),
                });
                onUpdated();
              }}
            >
              <select
                name="planningStep"
                defaultValue={trip.planningStep}
                className="h-10 rounded-md border border-black/10 bg-white px-2 text-sm"
              >
                {["setup", "activities", "housing", "transport", "votes", "validate", "done"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ActivitiesTab({
  trip,
  canEdit,
  onUpdated,
  tripId,
}: {
  trip: TripPayload["trip"];
  canEdit: boolean;
  onUpdated: () => void;
  tripId: string;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("sights");
  const [results, setResults] = useState<Array<{ placeId: string; displayName?: string; formattedAddress?: string }>>([]);
  const [dayIndex, setDayIndex] = useState(0);

  async function search() {
    const params = new URLSearchParams({ q: q || `${cat} in ${trip.destination}`, category: cat });
    if (trip.destinationLat != null && trip.destinationLng != null) {
      params.set("lat", String(trip.destinationLat));
      params.set("lng", String(trip.destinationLng));
    }
    const res = await fetch(`/api/places/search?${params.toString()}`);
    const json = await res.json();
    setResults(json.places ?? []);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Discover activities</CardTitle>
          <CardDescription>Search uses Google Places (New) with server caching; demo data appears without API keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1 text-xs ${cat === c ? "bg-[var(--color-accent)] text-white" : "bg-black/[0.06]"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search query (optional)" className="max-w-md" />
            <Label className="flex items-center gap-2 text-xs">
              Day
              <Input type="number" min={0} value={dayIndex} onChange={(e) => setDayIndex(parseInt(e.target.value, 10) || 0)} className="w-20" />
            </Label>
            <Button type="button" onClick={() => void search()}>
              Search
            </Button>
          </div>
          <ul className="space-y-2">
            {results.map((p) => (
              <li key={p.placeId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/8 p-3 text-sm">
                <div>
                  <p className="font-medium">{p.displayName ?? p.placeId}</p>
                  <p className="text-xs text-[var(--color-muted)]">{p.formattedAddress}</p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/trips/${tripId}/activities`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ placeId: p.placeId, category: cat, dayIndex }),
                      });
                      onUpdated();
                    }}
                  >
                    Add
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shortlisted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {trip.activityCandidates.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No activities yet.</p>
          ) : (
            <ul className="space-y-2">
              {trip.activityCandidates.map((a) => {
                const meta = a.metadataJson as { googleMapsUri?: string; estimatedCostCents?: number } | null;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/8 p-3 text-sm">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        day {a.dayIndex ?? "—"} · {a.category} · est. {centsToDisplay(meta?.estimatedCostCents ?? null)}
                      </p>
                      {meta?.googleMapsUri ? (
                        <a href={meta.googleMapsUri} className="text-xs text-[var(--color-accent)] underline" target="_blank" rel="noreferrer">
                          Maps
                        </a>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/trips/${tripId}/activities?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
                          onUpdated();
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HousingTab({
  trip,
  canEdit,
  onUpdated,
  tripId,
}: {
  trip: TripPayload["trip"];
  canEdit: boolean;
  onUpdated: () => void;
  tripId: string;
}) {
  const [offers, setOffers] = useState<
    Array<{
      providerHotelId: string;
      name: string;
      nightlyCents?: number;
      deepLinkUrl: string;
      provider: string;
    }>
  >([]);

  async function searchHotels() {
    if (trip.destinationLat == null || trip.destinationLng == null) {
      alert("Set destination latitude/longitude on the trip (edit via API or recreate trip) for hotel search.");
      return;
    }
    const checkIn = trip.startDate.slice(0, 10);
    const checkOut = trip.endDate.slice(0, 10);
    const params = new URLSearchParams({
      lat: String(trip.destinationLat),
      lng: String(trip.destinationLng),
      checkIn,
      checkOut,
      adults: String(trip.headcount),
    });
    const res = await fetch(`/api/amadeus/hotels?${params}`);
    const json = await res.json();
    setOffers(json.offers ?? []);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hotels (Amadeus)</CardTitle>
          <CardDescription>Indicative offers; deep links follow the normalized template until affiliate programs are onboarded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" onClick={() => void searchHotels()}>
            Search near destination
          </Button>
          <ul className="space-y-2">
            {offers.map((o) => (
              <li key={o.providerHotelId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/8 p-3 text-sm">
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{centsToDisplay(o.nightlyCents ?? null)} / night</p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/trips/${tripId}/housing`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          provider: o.provider,
                          providerHotelId: o.providerHotelId,
                          name: o.name,
                          nightlyCents: o.nightlyCents ?? null,
                          deepLinkUrl: o.deepLinkUrl,
                        }),
                      });
                      onUpdated();
                    }}
                  >
                    Add
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shortlisted stays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {trip.housingCandidates.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/8 p-3 text-sm">
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-xs text-[var(--color-muted)]">{centsToDisplay(h.nightlyCents)} / night</p>
                {h.deepLinkUrl ? (
                  <a href={h.deepLinkUrl} className="text-xs text-[var(--color-accent)] underline" target="_blank" rel="noreferrer">
                    Booking link
                  </a>
                ) : null}
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/trips/${tripId}/housing?id=${encodeURIComponent(h.id)}`, { method: "DELETE" });
                    onUpdated();
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TransportTab({
  trip,
  canEdit,
  onUpdated,
  tripId,
}: {
  trip: TripPayload["trip"];
  canEdit: boolean;
  onUpdated: () => void;
  tripId: string;
}) {
  const [origin, setOrigin] = useState("JFK");
  const [destination, setDestination] = useState("LIS");
  const [date, setDate] = useState(trip.startDate.slice(0, 10));
  const [offers, setOffers] = useState<
    Array<{ offerId: string; priceCents?: number; deepLinkUrl: string; segmentsJson: { slices: unknown[] } }>
  >([]);

  async function searchFlights() {
    const params = new URLSearchParams({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate: date,
      adults: String(trip.headcount),
    });
    const res = await fetch(`/api/amadeus/flights?${params}`);
    const json = await res.json();
    setOffers(json.offers ?? []);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Flights (Amadeus)</CardTitle>
          <CardDescription>Long legs as flight offers; local legs can be stubbed with drive/transit metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-24" placeholder="Origin" />
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} className="w-24" placeholder="Dest" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button type="button" onClick={() => void searchFlights()}>
              Search
            </Button>
          </div>
          <ul className="space-y-2">
            {offers.map((o) => (
              <li key={o.offerId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/8 p-3 text-sm">
                <div>
                  <p className="font-medium">{o.offerId}</p>
                  <p className="text-xs text-[var(--color-muted)]">{centsToDisplay(o.priceCents ?? null)}</p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/trips/${tripId}/transport`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          mode: "flight",
                          priceCents: o.priceCents ?? null,
                          segmentsJson: o.segmentsJson,
                          metadataJson: { offerId: o.offerId, deepLinkUrl: o.deepLinkUrl },
                        }),
                      });
                      onUpdated();
                    }}
                  >
                    Add
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transport shortlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {trip.transportCandidates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/8 p-3 text-sm">
              <div>
                <p className="font-medium">{t.mode}</p>
                <p className="text-xs text-[var(--color-muted)]">{centsToDisplay(t.priceCents)}</p>
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/trips/${tripId}/transport?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
                    onUpdated();
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AiTab({ tripId, canEdit, onUpdated }: { tripId: string; canEdit: boolean; onUpdated: () => void }) {
  const [out, setOut] = useState<unknown>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI orchestration</CardTitle>
        <CardDescription>Structured JSON from the model is validated with Zod; activities are grounded with Places search—not invented prices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <Button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/trips/${tripId}/ai/plan`, { method: "POST" });
              setOut(await res.json());
              onUpdated();
            }}
          >
            Generate criteria + grounded samples
          </Button>
        ) : null}
        {out ? <pre className="max-h-96 overflow-auto rounded-md bg-black/[0.04] p-3 text-xs">{JSON.stringify(out, null, 2)}</pre> : null}
      </CardContent>
    </Card>
  );
}

function VotesTab({
  trip,
  tripId,
  onUpdated,
}: {
  trip: TripPayload["trip"];
  tripId: string;
  onUpdated: () => void;
}) {
  const [day, setDay] = useState(0);
  const [leaderboard, setLeaderboard] = useState<Array<{ activityCandidateId: string; avgScore: number; votes: number; candidate: { name: string | null } }>>(
    [],
  );

  const refreshLb = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/votes?dayIndex=${day}`);
    const json = await res.json();
    setLeaderboard(json.leaderboard ?? []);
  }, [tripId, day]);

  useEffect(() => {
    void refreshLb();
  }, [refreshLb]);

  const dayActivities = trip.activityCandidates.filter((a) => (a.dayIndex ?? 0) === day);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vote per day</CardTitle>
          <CardDescription>Scores 1–5; leaderboard aggregates member votes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="flex items-center gap-2 text-sm">
            Day index
            <Input type="number" min={0} value={day} onChange={(e) => setDay(parseInt(e.target.value, 10) || 0)} className="w-24" />
          </Label>
          <ul className="space-y-2">
            {dayActivities.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/8 p-3 text-sm">
                <span>{a.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="secondary"
                      type="button"
                      className="min-w-8 px-2"
                      onClick={async () => {
                        await fetch(`/api/trips/${tripId}/votes`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ dayIndex: day, activityCandidateId: a.id, score: s }),
                        });
                        await refreshLb();
                        onUpdated();
                      }}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard (day {day})</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-4 text-sm">
            {leaderboard.map((row) => (
              <li key={row.activityCandidateId}>
                {row.candidate.name} — avg {row.avgScore.toFixed(2)} ({row.votes} votes)
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function ValidateTab({ tripId, canEdit }: { tripId: string; canEdit: boolean }) {
  const [result, setResult] = useState<unknown>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deterministic validation</CardTitle>
        <CardDescription>Budget rollup, route legs between sequenced stops (when lat/lng exist). AI suggests swaps if flags fail.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <Button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/trips/${tripId}/validate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxLegMinutes: 90 }),
              });
              setResult(await res.json());
            }}
          >
            Run validation
          </Button>
        ) : null}
        {result ? <pre className="max-h-96 overflow-auto rounded-md bg-black/[0.04] p-3 text-xs">{JSON.stringify(result, null, 2)}</pre> : null}
      </CardContent>
    </Card>
  );
}

function ShareTab({ tripId, canEdit }: { tripId: string; canEdit: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invites</CardTitle>
        <CardDescription>Share a link; accepting requires sign-in. Editors can generate invites.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <Button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/trips/${tripId}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: "EDITOR" }),
              });
              const json = await res.json();
              setLink(json.link ?? null);
            }}
          >
            Create invite link
          </Button>
        ) : null}
        {link ? (
          <p className="break-all text-sm">
            <span className="text-[var(--color-muted)]">Link: </span>
            {link}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
