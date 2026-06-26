import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass through API routes and Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // getToken reads the JWT cookie — Edge-compatible, no pg/prisma needed
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
