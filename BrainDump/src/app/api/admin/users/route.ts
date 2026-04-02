import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-email";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const search = (searchParams.get("q") ?? "").trim();

  try {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          // Auth providers — don't include tokens, just the provider name
          accounts: { select: { provider: true } },
          _count: {
            select: {
              dumps: true,
              items: true,
            },
          },
          // Whether credentials login is set up (presence of passwordHash, not the hash itself)
          passwordHash: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        hasPassword: Boolean(u.passwordHash),
        providers: u.accounts.map((a) => a.provider),
        dumpCount: u._count.dumps,
        itemCount: u._count.items,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (e) {
    console.error("admin users GET:", e);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id");
  if (!userId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Prevent admin from deleting their own account via the dashboard
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (adminId && adminId === userId) {
    return NextResponse.json({ error: "Cannot delete your own admin account" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin users DELETE:", e);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
