"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SITE_CONFIG_CHANGED_EVENT } from "@/components/SiteConfigProvider";

type StatsPayload = {
  users: {
    total: number;
    withPassword: number;
    googleAccountsLinked: number;
    newLast7Days: number;
    newLast30Days: number;
    activeLast7Days: number;
  };
  content: {
    dumpsTotal: number;
    dumpsLast7Days: number;
    itemsTotal: number;
    itemsActive: number;
    itemsLast7Days: number;
    projectsTotal: number;
  };
  breakdown: {
    itemTypes: { type: string; count: number }[];
    dumpsByStatus: { status: string; count: number }[];
  };
  integrations: {
    databaseUrlConfigured: boolean;
    authSecretConfigured: boolean;
    authUrlConfigured: boolean;
    googleOAuthConfigured: boolean;
    appleOAuthConfigured: boolean;
    resendConfigured: boolean;
  };
  generatedAt: string;
};

function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "1rem 1.1rem",
        borderRadius: "var(--card-radius)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ fontSize: "1.65rem", fontWeight: 700, marginTop: "0.35rem", color: "var(--text-primary)" }}>{value}</div>
      {hint ? <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>{hint}</div> : null}
    </div>
  );
}

function BoolPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.25rem 0.55rem",
        borderRadius: 999,
        fontSize: "0.78rem",
        fontWeight: 600,
        background: ok ? "color-mix(in srgb, #16a34a 18%, transparent)" : "color-mix(in srgb, var(--accent) 14%, transparent)",
        color: "var(--text-primary)",
      }}
    >
      {ok ? "●" : "○"} {label}
    </span>
  );
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [rc, setRc] = useState<boolean | null>(null);
  const [rcSaving, setRcSaving] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    const res = await fetch("/api/admin/stats", { cache: "no-store" });
    if (res.status === 403) {
      setStats(null);
      setStatsError("forbidden");
      return;
    }
    if (!res.ok) {
      setStatsError("load_failed");
      return;
    }
    setStats((await res.json()) as StatsPayload);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as { revenueCatEnabled?: boolean };
    if (typeof d.revenueCatEnabled === "boolean") setRc(d.revenueCatEnabled);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    void loadStats();
    void loadSettings();
  }, [status, session?.user?.email, loadStats, loadSettings]);

  const saveRc = async (next: boolean) => {
    setRcSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueCatEnabled: next }),
      });
      if (res.ok) {
        setRc(next);
        window.dispatchEvent(new Event(SITE_CONFIG_CHANGED_EVENT));
      }
    } finally {
      setRcSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", padding: "1.5rem" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.35rem", marginBottom: "0.5rem" }}>Admin dashboard</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
            Sign in with the same BrainDump account you listed in <code style={{ fontSize: "0.85em" }}>ADMIN_EMAILS</code>.
          </p>
          <Link href="/login?callbackUrl=%2Fadmin" className="bd-btn bd-btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
            Sign in
          </Link>
          <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            <Link href="/" style={{ color: "var(--accent)" }}>
              Back to app
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (statsError === "forbidden") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", padding: "1.5rem" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.35rem", marginBottom: "0.5rem" }}>Access denied</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Your account ({session?.user?.email ?? "unknown"}) is not in <code>ADMIN_EMAILS</code>. Add it in Vercel env (comma-separated), redeploy, then try again.
          </p>
          <p style={{ marginTop: "1rem" }}>
            <Link href="/" style={{ color: "var(--accent)" }}>
              Back to app
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", padding: "1.25rem 1.5rem 2.5rem" }}>
      <header style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>System dashboard</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Signed in as {session?.user?.email}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="bd-btn" onClick={() => void loadStats()}>
            Refresh stats
          </button>
          <Link href="/" className="bd-btn">
            Open app
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {statsError === "load_failed" && (
          <p style={{ color: "var(--accent)", margin: 0 }}>Could not load stats (database or schema issue?). Check server logs.</p>
        )}

        {stats && (
          <>
            <section>
              <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem" }}>People &amp; activity</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
                <Card title="Registered users" value={stats.users.total} />
                <Card title="Email + password" value={stats.users.withPassword} hint="Can use credentials login" />
                <Card title="Active last 7 days" value={stats.users.activeLast7Days} hint="Created dump or item this week" />
                <Card title="New signups 7d" value={stats.users.newLast7Days} />
                <Card title="New signups 30d" value={stats.users.newLast30Days} />
                <Card title="Google links" value={stats.users.googleAccountsLinked} hint="Account rows (OAuth)" />
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem" }}>Content volume</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
                <Card title="Total dumps" value={stats.content.dumpsTotal} />
                <Card title="Dumps (7d)" value={stats.content.dumpsLast7Days} hint="Usage frequency" />
                <Card title="Organized items" value={stats.content.itemsActive} hint="Excludes trash" />
                <Card title="Items (7d)" value={stats.content.itemsLast7Days} />
                <Card title="Projects" value={stats.content.projectsTotal} />
                <Card title="Items (all rows)" value={stats.content.itemsTotal} hint="Includes deleted" />
              </div>
            </section>

            <section
              style={{
                padding: "1rem 1.1rem",
                borderRadius: "var(--card-radius)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.65rem" }}>Integrations &amp; env (no secrets shown)</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <BoolPill ok={stats.integrations.databaseUrlConfigured} label="Database URL" />
                <BoolPill ok={stats.integrations.authSecretConfigured} label="AUTH_SECRET" />
                <BoolPill ok={stats.integrations.authUrlConfigured} label="AUTH_URL / public URL" />
                <BoolPill ok={stats.integrations.googleOAuthConfigured} label="Google OAuth" />
                <BoolPill ok={stats.integrations.appleOAuthConfigured} label="Apple OAuth" />
                <BoolPill ok={stats.integrations.resendConfigured} label="Resend email" />
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "0.75rem 0 0" }}>
                OAuth redirect hints:{" "}
                <a href="/api/auth/oauth-redirect-hints" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                  /api/auth/oauth-redirect-hints
                </a>
              </p>
            </section>

            <section
              style={{
                padding: "1rem 1.1rem",
                borderRadius: "var(--card-radius)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>RevenueCat (global)</h2>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: "0 0 0.75rem", maxWidth: 640 }}>
                Controlled server-side. Users no longer see this in Settings. Turning it off signals the app to skip paywall / SDK hooks that read this flag.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: rcSaving ? "wait" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={rc !== false}
                  disabled={rc === null || rcSaving}
                  onChange={(e) => void saveRc(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                />
                <span style={{ fontWeight: 600 }}>RevenueCat enabled</span>
              </label>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--card-radius)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                }}
              >
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Top item types</h3>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  {stats.breakdown.itemTypes.map((r) => (
                    <li key={r.type}>
                      <strong style={{ color: "var(--text-primary)" }}>{r.type}</strong> — {r.count}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "var(--card-radius)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                }}
              >
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Dumps by status</h3>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  {stats.breakdown.dumpsByStatus.map((r) => (
                    <li key={r.status}>
                      <strong style={{ color: "var(--text-primary)" }}>{r.status}</strong> — {r.count}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section
              style={{
                padding: "1rem 1.1rem",
                borderRadius: "var(--card-radius)",
                border: "1px dashed var(--border-default)",
                fontSize: "0.85rem",
                color: "var(--text-tertiary)",
              }}
            >
              <strong style={{ color: "var(--text-secondary)" }}>Security note:</strong> admin access is only your normal login plus{" "}
              <code>ADMIN_EMAILS</code>. Use a strong password; 2FA on Google helps if you use Google sign-in. This dashboard is not a separate secret
              password.
              <div style={{ marginTop: "0.5rem" }}>Stats generated {new Date(stats.generatedAt).toLocaleString()}.</div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
