import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDatabaseUrl } from "@/lib/database-url";
import { prismaErrorMeta } from "@/lib/prisma-error-meta";
import { hash } from "bcryptjs";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json(
        {
          error:
            "Database is not configured. Set a non-empty DATABASE_URL or rely on Vercel Postgres variables (POSTGRES_PRISMA_URL / POSTGRES_URL).",
        },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const name = typeof (body as { name?: unknown }).name === "string" ? (body as { name: string }).name.trim() : "";
    const email =
      typeof (body as { email?: unknown }).email === "string" ? (body as { email: string }).email.trim().toLowerCase() : "";
    const password =
      typeof (body as { password?: unknown }).password === "string" ? (body as { password: string }).password : "";

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
    const { code, message } = prismaErrorMeta(e);
    console.error("Register error:", code ?? "no-code", message, e);

    if (code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    if (
      code === "P2009" ||
      code === "P2021" ||
      code === "P2022" ||
      message.includes("Unknown arg") ||
      message.includes("passwordHash") ||
      message.includes("does not exist")
    ) {
      return NextResponse.json(
        {
          error:
            "Server database is out of sync. Run `npx prisma db push` (or migrate) against the production database, then redeploy.",
        },
        { status: 503 }
      );
    }

    if (
      code === "P1001" ||
      code === "P1000" ||
      code === "P1013" ||
      code === "P1017" ||
      /connect|ECONNREFUSED|timeout|certificate/i.test(message)
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot reach the database. Confirm DATABASE_URL / Neon / Vercel Postgres env vars on the server and that the DB allows connections.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Registration failed (${code ?? "error"}): ${message}`
            : "Registration failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
