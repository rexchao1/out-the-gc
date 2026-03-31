import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = new Set(["/", "/login", "/register"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api")) return NextResponse.next();
  if (pathname.startsWith("/invite/")) return NextResponse.next();
  if (publicPaths.has(pathname)) return NextResponse.next();

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
