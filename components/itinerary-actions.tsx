"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ItineraryActions({ tripId, isOwner }: { tripId: string; isOwner: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          setMsg(null);
          const res = await fetch(`/api/trips/${tripId}/itinerary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: "Published shortlist" }),
          });
          if (!res.ok) setMsg("Could not publish");
          else {
            setMsg("Published.");
            router.refresh();
          }
        }}
      >
        Publish current shortlist
      </Button>
      {isOwner ? (
        <Button
          type="button"
          onClick={async () => {
            setMsg(null);
            const res = await fetch(`/api/trips/${tripId}/itinerary`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ applyFromVotes: true, label: "From votes" }),
            });
            if (!res.ok) setMsg("Could not apply votes (owner only)");
            else {
              setMsg("Applied top votes per day.");
              router.refresh();
            }
          }}
        >
          Apply top votes (owner)
        </Button>
      ) : null}
      {msg ? <span className="self-center text-sm text-[var(--color-muted)]">{msg}</span> : null}
    </div>
  );
}
