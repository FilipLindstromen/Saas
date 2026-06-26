import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [projectCount, leadCount, metaCount, sioConn] = await Promise.all([
    prisma.project.count({ where: { userId } }),
    prisma.lead.count({ where: { project: { userId } } }),
    prisma.metaConnection.count({ where: { userId } }),
    prisma.systemeioConnection.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  const recentLeads = await prisma.lead.findMany({
    where: { project: { userId } },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const stats = [
    {
      label: "Active Projects",
      value: projectCount,
      icon: "📁",
      color: "#2563eb",
      bg: "#eff6ff",
      href: "/projects",
    },
    {
      label: "Total Leads",
      value: leadCount,
      icon: "👥",
      color: "#16a34a",
      bg: "#f0fdf4",
      href: "/leads",
    },
    {
      label: "Meta Pages",
      value: metaCount,
      icon: "📘",
      color: "#7c3aed",
      bg: "#f5f3ff",
      href: "/connections",
    },
    {
      label: "Systeme.io",
      value: sioConn ? "Connected" : "Not connected",
      icon: "🔗",
      color: sioConn ? "#16a34a" : "#dc2626",
      bg: sioConn ? "#f0fdf4" : "#fef2f2",
      href: "/connections",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>
          Welcome back, {session?.user?.name ?? "there"} 👋
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            style={{ textDecoration: "none" }}
          >
            <div
              className="card"
              style={{
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "transform 150ms, box-shadow 150ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgb(0 0 0 / 0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "";
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: stat.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                {stat.icon}
              </div>
              <div>
                <div
                  style={{ fontSize: 26, fontWeight: 700, color: stat.color, lineHeight: 1.1 }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{stat.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      {(metaCount === 0 || !sioConn || projectCount === 0) && (
        <div className="card" style={{ padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>
            Get started
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {metaCount === 0 && (
              <SetupStep
                number={1}
                title="Connect a Facebook Page"
                description="Link your Facebook Page and optionally an Instagram account"
                href="/connections"
                done={false}
              />
            )}
            {!sioConn && (
              <SetupStep
                number={metaCount === 0 ? 2 : 1}
                title="Connect Systeme.io"
                description="Enter your API key to enable contact syncing"
                href="/connections"
                done={false}
              />
            )}
            {projectCount === 0 && metaCount > 0 && (
              <SetupStep
                number={1}
                title="Create your first project"
                description="Set up a comment automation or lead form sync"
                href="/projects/new"
                done={false}
              />
            )}
          </div>
        </div>
      )}

      {/* Recent Leads */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#0f172a" }}>Recent Leads</h2>
          <Link href="/leads" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
            View all →
          </Link>
        </div>

        {recentLeads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <p style={{ margin: 0, fontSize: 14 }}>No leads collected yet. Create a project to start.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {recentLeads.map((lead) => (
              <div
                key={lead.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: "#eff6ff",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>{lead.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{lead.email}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`badge badge-${lead.source === "comment" ? "blue" : "green"}`}>
                    {lead.source === "comment" ? "Comment" : "Lead Form"}
                  </span>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    {lead.project.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupStep({
  number,
  title,
  description,
  href,
  done,
}: {
  number: number;
  title: string;
  description: string;
  href: string;
  done: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: done ? "#f0fdf4" : "#fafafa",
          transition: "background 150ms, border-color 150ms",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: done ? "#16a34a" : "#2563eb",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {done ? "✓" : number}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{title}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{description}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}
