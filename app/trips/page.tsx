import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TripsPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { where: { userId }, take: 1 },
      _count: { select: { members: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your trips</h1>
          <p className="text-sm text-[var(--color-muted)]">Collaborate, vote per day, and publish an itinerary snapshot.</p>
        </div>
        <Button asChild>
          <Link href="/trips/new">New trip</Link>
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No trips yet</CardTitle>
            <CardDescription>Create a trip to start planning with real places and travel APIs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/trips/new">Create your first trip</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {trips.map((t) => (
            <li key={t.id}>
              <Link href={`/trips/${t.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                    <CardDescription>
                      {t.destination} · {t.members[0]?.role ?? "member"} · {t._count.members} members
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-[var(--color-muted)]">
                    Step: {t.planningStep} · Updated {t.updatedAt.toLocaleDateString()}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
