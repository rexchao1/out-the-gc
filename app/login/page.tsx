import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";
import { Suspense } from "react";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/trips");

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--color-muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
