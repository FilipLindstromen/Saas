import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    const where = domain ? { userId, domain } : { userId };
    const projects = await prisma.project.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("Projects GET error:", e);
    const message = getDbErrorMessage(e) || "Failed to fetch projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;
    const body = await request.json();
    const { name, domain, description, status } = body;

    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId,
        name: String(name),
        domain: domain ?? "work",
        description: description ?? "",
        status: status ?? "active",
      },
    });
    return NextResponse.json({ project });
  } catch (e) {
    console.error("Projects POST error:", e);
    const message = getDbErrorMessage(e) || "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
