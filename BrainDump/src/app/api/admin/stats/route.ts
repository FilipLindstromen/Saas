import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-email";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  try {
    const [
      usersTotal,
      usersWithPassword,
      usersWithGoogle,
      newUsers7d,
      newUsers30d,
      dumpsTotal,
      dumpsLast7d,
      itemsTotal,
      itemsActive,
      itemsLast7d,
      projectsTotal,
      activeUsers7d,
      itemTypes,
      dumpStatuses,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { passwordHash: { not: null } } }),
      prisma.account.count({ where: { provider: "google" } }),
      prisma.user.count({ where: { createdAt: { gte: d7 } } }),
      prisma.user.count({ where: { createdAt: { gte: d30 } } }),
      prisma.dump.count(),
      prisma.dump.count({ where: { createdAt: { gte: d7 } } }),
      prisma.organizedItem.count(),
      prisma.organizedItem.count({ where: { deletedAt: null } }),
      prisma.organizedItem.count({
        where: { deletedAt: null, createdAt: { gte: d7 } } },
      ),
      prisma.project.count(),
      prisma.user.count({
        where: {
          OR: [
            { dumps: { some: { createdAt: { gte: d7 } } } },
            { items: { some: { deletedAt: null, createdAt: { gte: d7 } } } },
          ],
        },
      }),
      prisma.organizedItem.groupBy({
        by: ["itemType"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.dump.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const integrations = {
      databaseUrlConfigured: Boolean(
        process.env.DATABASE_URL?.trim() ||
          process.env.NEON_DATABASE_URL?.trim() ||
          process.env.POSTGRES_PRISMA_URL?.trim() ||
          process.env.POSTGRES_URL?.trim()
      ),
      authSecretConfigured: Boolean(process.env.AUTH_SECRET?.trim()),
      authUrlConfigured: Boolean(
        (process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim()
      ),
      googleOAuthConfigured: Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
      ),
      appleOAuthConfigured: Boolean(
        process.env.AUTH_APPLE_ID?.trim() && process.env.AUTH_APPLE_SECRET?.trim()
      ),
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    };

    const itemTypeRows = [...itemTypes]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 12)
      .map((r) => ({ type: r.itemType, count: r._count._all }));

    return NextResponse.json({
      users: {
        total: usersTotal,
        withPassword: usersWithPassword,
        googleAccountsLinked: usersWithGoogle,
        newLast7Days: newUsers7d,
        newLast30Days: newUsers30d,
        activeLast7Days: activeUsers7d,
      },
      content: {
        dumpsTotal,
        dumpsLast7Days: dumpsLast7d,
        itemsTotal,
        itemsActive,
        itemsLast7Days: itemsLast7d,
        projectsTotal,
      },
      breakdown: {
        itemTypes: itemTypeRows,
        dumpsByStatus: dumpStatuses.map((r) => ({ status: r.status, count: r._count._all })),
      },
      integrations,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("admin stats error:", e);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
