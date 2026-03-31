import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">Out of the GC</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Plan group trips together—with real places and travel data.</h1>
        <p className="text-lg text-[var(--color-muted)]">
          Set a destination and budget, discover activities with Google Places, sketch stays and transport with Amadeus, vote per day, and
          validate the plan before you share booking links.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {session?.user ? (
          <Button asChild>
            <Link href="/trips">Your trips</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
