import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function TripsNav({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/trips" className="font-semibold tracking-tight text-[var(--color-accent)]">
            Out of the GC
          </Link>
          <nav className="hidden gap-4 text-sm text-[var(--color-muted)] sm:flex">
            <Link href="/trips" className="hover:text-foreground">
              Trips
            </Link>
            <Link href="/trips/new" className="hover:text-foreground">
              New trip
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email ? <span className="hidden max-w-[200px] truncate text-xs text-[var(--color-muted)] sm:inline">{email}</span> : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
