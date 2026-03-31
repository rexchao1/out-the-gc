import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function NewTripPage() {
  async function createTrip(formData: FormData) {
    "use server";
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) redirect("/login?callbackUrl=/trips/new");

    const name = String(formData.get("name") ?? "").trim();
    const destination = String(formData.get("destination") ?? "").trim();
    const startDate = String(formData.get("startDate") ?? "");
    const endDate = String(formData.get("endDate") ?? "");
    const headcount = parseInt(String(formData.get("headcount") ?? "1"), 10);
    const budget = String(formData.get("budget") ?? "").trim();
    const lat = String(formData.get("lat") ?? "").trim();
    const lng = String(formData.get("lng") ?? "").trim();

    if (!name || !destination || !startDate || !endDate) {
      redirect("/trips/new?error=missing");
    }

    const totalBudgetCents =
      budget !== "" && !Number.isNaN(parseFloat(budget)) ? Math.round(parseFloat(budget) * 100) : null;

    const trip = await prisma.trip.create({
      data: {
        name,
        destination,
        destinationLat: lat ? parseFloat(lat) : undefined,
        destinationLng: lng ? parseFloat(lng) : undefined,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        headcount: Number.isFinite(headcount) && headcount > 0 ? headcount : 1,
        totalBudgetCents: totalBudgetCents ?? undefined,
        createdById: userId,
        planningStep: "activities",
        members: { create: { userId, role: "OWNER" } },
      },
    });
    redirect(`/trips/${trip.id}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/trips" className="text-sm text-[var(--color-muted)] hover:text-foreground">
          ← Back to trips
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New trip</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Trip basics</CardTitle>
          <CardDescription>Optional coordinates help Places search bias and hotel geocode queries.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTrip} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Trip name</Label>
              <Input id="name" name="name" required placeholder="Summer in Lisbon" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input id="destination" name="destination" required placeholder="Lisbon, Portugal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="headcount">Headcount</Label>
              <Input id="headcount" name="headcount" type="number" min={1} defaultValue={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Total budget (USD, optional)</Label>
              <Input id="budget" name="budget" type="number" min={0} step="0.01" placeholder="2500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude (optional)</Label>
                <Input id="lat" name="lat" placeholder="38.7223" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude (optional)</Label>
                <Input id="lng" name="lng" placeholder="-9.1393" />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Create trip
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
