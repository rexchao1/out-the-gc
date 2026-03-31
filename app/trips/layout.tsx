import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TripsNav } from "@/components/trips-nav";

export default async function TripsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/trips");

  return (
    <div className="min-h-screen">
      <TripsNav email={session.user.email} />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
