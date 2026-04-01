import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteButton } from "@/components/accept-invite-button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { trip: { select: { id: true, name: true, destination: true } } },
  });

  if (!invite) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
            <CardDescription>This link is not valid.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Invite expired</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const session = await auth();

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Join trip</CardTitle>
          <CardDescription>
            You’ve been invited to <strong>{invite.trip.name}</strong> ({invite.trip.destination}) as {invite.role.toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session?.user ? (
            <AcceptInviteButton token={token} tripId={invite.trip.id} />
          ) : (
            <>
              <p className="text-sm text-[var(--color-muted)]">Sign in to accept this invite.</p>
              <Button asChild>
                <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}>Sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
