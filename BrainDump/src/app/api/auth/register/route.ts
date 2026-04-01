import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDatabaseUrl } from "@/lib/database-url";
import { hash } from "bcryptjs";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json(
        {
          error:
            "Database is not configured. Set DATABASE_URL or POSTGRES_PRISMA_URL / POSTGRES_URL (e.g. from Vercel Postgres).",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 10);
    await prisma.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
        clientPreferences: {},
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error("Register error:", e);

    // Unique violation (race: two sign-ups for same email)
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Schema out of date: passwordHash column missing (run prisma db push on production)
    if (err?.code === "P2009" || err?.message?.includes("Unknown arg") || err?.message?.includes("passwordHash")) {
      return NextResponse.json(
        { error: "Server database schema is out of date. Please run 'prisma db push' against your production database and redeploy." },
        { status: 503 }
      );
    }

    // Connection / DB unreachable
    if (err?.code === "P1001" || err?.code === "P1017" || err?.message?.includes("connect")) {
      return NextResponse.json(
        { error: "Database is not available. Check DATABASE_URL and that the database is running." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
