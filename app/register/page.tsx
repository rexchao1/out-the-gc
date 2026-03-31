import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/trips");

  async function registerAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!email || password.length < 8) {
      redirect("/register?error=invalid");
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect("/register?error=taken");
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { email, name: name || null, passwordHash },
    });
    redirect("/login?registered=1");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Password must be at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input id="name" name="name" type="text" autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
            </div>
            <Button type="submit" className="w-full">
              Register
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
