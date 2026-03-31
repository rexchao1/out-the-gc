"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token, tripId }: { token: string; tripId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, { method: "POST" });
        setPending(false);
        if (res.ok) router.push(`/trips/${tripId}`);
      }}
    >
      {pending ? "Joining…" : "Accept invite"}
    </Button>
  );
}
