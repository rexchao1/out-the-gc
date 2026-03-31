import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { assertMember } from "@/lib/trip-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/utils";
import { ItineraryActions } from "@/components/itinerary-actions";

function nightsBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function ItineraryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { tripId } = await params;
  const check = await assertMember(tripId, userId);
  if ("error" in check) notFound();

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      activityCandidates: true,
      housingCandidates: true,
      transportCandidates: true,
      itineraryVersions: { where: { isActive: true }, take: 1 },
    },
  });

  if (!trip) notFound();

  const active = trip.itineraryVersions[0] ?? null;
  const nights = nightsBetween(trip.startDate, trip.endDate);

  let housingCents = 0;
  for (const h of trip.housingCandidates) {
    if (h.nightlyCents != null) housingCents += h.nightlyCents * nights;
  }
  let transportCents = 0;
  for (const t of trip.transportCandidates) {
    if (t.priceCents != null) transportCents += t.priceCents;
  }
  let activityCents = 0;
  for (const a of trip.activityCandidates) {
    const meta = a.metadataJson as { estimatedCostCents?: number } | null;
    if (meta?.estimatedCostCents) activityCents += meta.estimatedCostCents;
  }
  const combined = housingCents + transportCents + activityCents;

  const isOwner = check.membership.role === "OWNER";
  const canEdit = check.membership.role === "OWNER" || check.membership.role === "EDITOR";

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <div>
        <Link href={`/trips/${tripId}`} className="text-sm text-[var(--color-muted)] hover:text-foreground">
          ← Planner
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Itinerary — {trip.name}</h1>
        <p className="text-sm text-[var(--color-muted)]">{trip.destination}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost rollup (indicative)</CardTitle>
          <CardDescription>Summed from shortlisted candidates; re-validate before booking.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-[var(--color-muted)]">Housing ({nights} nights): </span>
            {centsToDisplay(housingCents)}
          </p>
          <p>
            <span className="text-[var(--color-muted)]">Transport: </span>
            {centsToDisplay(transportCents)}
          </p>
          <p>
            <span className="text-[var(--color-muted)]">Activities (est.): </span>
            {centsToDisplay(activityCents)}
          </p>
          <p className="font-medium">
            <span className="text-[var(--color-muted)]">Combined: </span>
            {centsToDisplay(combined)}
          </p>
          <p>
            <span className="text-[var(--color-muted)]">Budget: </span>
            {centsToDisplay(trip.totalBudgetCents)}
          </p>
        </CardContent>
      </Card>

      {canEdit ? <ItineraryActions tripId={tripId} isOwner={isOwner} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Active snapshot</CardTitle>
          <CardDescription>Publish from the planner to freeze a shareable version.</CardDescription>
        </CardHeader>
        <CardContent>
          {active ? (
            <pre className="max-h-[480px] overflow-auto rounded-md bg-black/[0.04] p-3 text-xs">{JSON.stringify(active.snapshot, null, 2)}</pre>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No published itinerary yet. Use the buttons above to publish.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-[var(--color-muted)]">Stays</p>
          <ul className="space-y-1">
            {trip.housingCandidates.map((h) => (
              <li key={h.id}>
                {h.name}
                {h.deepLinkUrl ? (
                  <>
                    {" — "}
                    <a href={h.deepLinkUrl} className="text-[var(--color-accent)] underline" target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="pt-2 text-[var(--color-muted)]">Maps / activities</p>
          <ul className="space-y-1">
            {trip.activityCandidates.map((a) => {
              const meta = a.metadataJson as { googleMapsUri?: string } | null;
              return (
                <li key={a.id}>
                  {a.name}
                  {meta?.googleMapsUri ? (
                    <>
                      {" — "}
                      <a href={meta.googleMapsUri} className="text-[var(--color-accent)] underline" target="_blank" rel="noreferrer">
                        Google Maps
                      </a>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
