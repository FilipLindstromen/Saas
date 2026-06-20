"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SITE_CONFIG_CHANGED_EVENT } from "@/components/SiteConfigProvider";
import { AdminAiInstructionsSection } from "@/components/AdminAiInstructionsSection";

type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  hasPassword: boolean;
  providers: string[];
  dumpCount: number;
  itemCount: number;
};

type UsersPayload = {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
};

type AiInstructionDefaults = {
  organizeSystemPromptEn: string;
  organizeSystemPromptSv: string;
  coachSystemPrompt: string;
};

type AdminSettingsPayload = {
  revenueCatEnabled?: boolean;
  organizeSystemPromptEn?: string | null;
  organizeSystemPromptSv?: string | null;
  coachSystemPrompt?: string | null;
  defaults?: AiInstructionDefaults;
};

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
  const [organizeEn, setOrganizeEn] = useState("");
  const [organizeSv, setOrganizeSv] = useState("");
  const [coachPrompt, setCoachPrompt] = useState("");
  const [aiDefaults, setAiDefaults] = useState<AiInstructionDefaults | null>(null);
  const [aiUsingCustomEn, setAiUsingCustomEn] = useState(false);
  const [aiUsingCustomSv, setAiUsingCustomSv] = useState(false);
  const [aiUsingCustomCoach, setAiUsingCustomCoach] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const [usersData, setUsersData] = useState<UsersPayload | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersSearchInput, setUsersSearchInput] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    const d = (await res.json()) as AdminSettingsPayload;
    if (typeof d.revenueCatEnabled === "boolean") setRc(d.revenueCatEnabled);
    if (d.defaults) {
      setAiDefaults(d.defaults);
      setOrganizeEn(d.organizeSystemPromptEn ?? d.defaults.organizeSystemPromptEn);
      setOrganizeSv(d.organizeSystemPromptSv ?? d.defaults.organizeSystemPromptSv);
      setCoachPrompt(d.coachSystemPrompt ?? d.defaults.coachSystemPrompt);
      setAiUsingCustomEn(d.organizeSystemPromptEn != null);
      setAiUsingCustomSv(d.organizeSystemPromptSv != null);
      setAiUsingCustomCoach(d.coachSystemPrompt != null);
    }
  }, []);

  const loadUsers = useCallback(async (page: number, search: string) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      if (res.ok) setUsersData((await res.json()) as UsersPayload);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const deleteUser = async (user: AdminUser) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        void loadUsers(usersPage, usersSearch);
        void loadStats();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    void loadStats();
    void loadSettings();
    void loadUsers(1, "");
  }, [status, session?.user?.email, loadStats, loadSettings, loadUsers]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    void loadUsers(usersPage, usersSearch);
  }, [usersPage, usersSearch, status, session?.user?.email, loadUsers]);

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

  const promptOverrideOrNull = (value: string, defaultValue: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed === defaultValue.trim() ? null : trimmed;
  };

  const saveAiInstructions = async () => {
    if (!aiDefaults) return;
    setAiSaving(true);
    setAiMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizeSystemPromptEn: promptOverrideOrNull(organizeEn, aiDefaults.organizeSystemPromptEn),
          organizeSystemPromptSv: promptOverrideOrNull(organizeSv, aiDefaults.organizeSystemPromptSv),
          coachSystemPrompt: promptOverrideOrNull(coachPrompt, aiDefaults.coachSystemPrompt),
        }),
      });
      const data = (await res.json()) as AdminSettingsPayload & { error?: string };
      if (!res.ok) {
        setAiMessage(data.error ?? "Could not save AI instructions.");
        return;
      }
      setAiUsingCustomEn(data.organizeSystemPromptEn != null);
      setAiUsingCustomSv(data.organizeSystemPromptSv != null);
      setAiUsingCustomCoach(data.coachSystemPrompt != null);
      setAiMessage("Saved. All users will use these prompts for organize and coach.");
    } finally {
      setAiSaving(false);
    }
  };

  const resetAiInstructions = async () => {
    if (!aiDefaults) return;
    setOrganizeEn(aiDefaults.organizeSystemPromptEn);
    setOrganizeSv(aiDefaults.organizeSystemPromptSv);
    setCoachPrompt(aiDefaults.coachSystemPrompt);
    setAiSaving(true);
    setAiMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizeSystemPromptEn: null,
          organizeSystemPromptSv: null,
          coachSystemPrompt: null,
        }),
      });
      if (res.ok) {
        setAiUsingCustomEn(false);
        setAiUsingCustomSv(false);
        setAiUsingCustomCoach(false);
        setAiMessage("Reset to built-in defaults.");
      }
    } finally {
      setAiSaving(false);
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

        <AdminAiInstructionsSection
          organizeEn={organizeEn}
          organizeSv={organizeSv}
          coachPrompt={coachPrompt}
          aiDefaultsLoaded={aiDefaults != null}
          aiUsingCustomEn={aiUsingCustomEn}
          aiUsingCustomSv={aiUsingCustomSv}
          aiUsingCustomCoach={aiUsingCustomCoach}
          aiSaving={aiSaving}
          aiMessage={aiMessage}
          onOrganizeEnChange={setOrganizeEn}
          onOrganizeSvChange={setOrganizeSv}
          onCoachPromptChange={setCoachPrompt}
          onSave={() => void saveAiInstructions()}
          onReset={() => void resetAiInstructions()}
        />

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
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.75rem" }}>
                <h2 style={{ fontSize: "1.05rem", margin: 0 }}>
                  Users{usersData ? <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-tertiary)", marginLeft: "0.5rem" }}>({usersData.total} total)</span> : null}
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setUsersPage(1);
                    setUsersSearch(usersSearchInput);
                  }}
                  style={{ display: "flex", gap: "0.4rem" }}
                >
                  <input
                    type="search"
                    placeholder="Search email or name…"
                    value={usersSearchInput}
                    onChange={(e) => setUsersSearchInput(e.target.value)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: 6,
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      fontSize: "0.85rem",
                      width: 200,
                    }}
                  />
                  <button type="submit" className="bd-btn" style={{ fontSize: "0.85rem", padding: "0.3rem 0.7rem" }}>
                    Search
                  </button>
                  {usersSearch && (
                    <button
                      type="button"
                      className="bd-btn"
                      style={{ fontSize: "0.85rem", padding: "0.3rem 0.7rem" }}
                      onClick={() => { setUsersSearch(""); setUsersSearchInput(""); setUsersPage(1); }}
                    >
                      Clear
                    </button>
                  )}
                </form>
              </div>

              {usersLoading && !usersData && (
                <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", margin: 0 }}>Loading…</p>
              )}

              {usersData && (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                          {["Email", "Name", "Joined", "Auth", "Dumps", "Items", ""].map((h) => (
                            <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {usersData.users.map((u) => (
                          <tr
                            key={u.id}
                            style={{ borderBottom: "1px solid var(--border-subtle)" }}
                          >
                            <td style={{ padding: "0.45rem 0.6rem", color: "var(--text-primary)", wordBreak: "break-all" }}>{u.email ?? "—"}</td>
                            <td style={{ padding: "0.45rem 0.6rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{u.name ?? "—"}</td>
                            <td style={{ padding: "0.45rem 0.6rem", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", whiteSpace: "nowrap" }}>
                              <span style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                {u.hasPassword && (
                                  <span style={{ fontSize: "0.75rem", padding: "0.1rem 0.45rem", borderRadius: 999, background: "color-mix(in srgb, var(--border-default) 60%, transparent)", color: "var(--text-secondary)" }}>
                                    password
                                  </span>
                                )}
                                {u.providers.map((p) => (
                                  <span key={p} style={{ fontSize: "0.75rem", padding: "0.1rem 0.45rem", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--text-primary)" }}>
                                    {p}
                                  </span>
                                ))}
                              </span>
                            </td>
                            <td style={{ padding: "0.45rem 0.6rem", color: "var(--text-secondary)", textAlign: "right" }}>{u.dumpCount}</td>
                            <td style={{ padding: "0.45rem 0.6rem", color: "var(--text-secondary)", textAlign: "right" }}>{u.itemCount}</td>
                            <td style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(u)}
                                style={{
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: 6,
                                  border: "1px solid color-mix(in srgb, var(--accent) 50%, transparent)",
                                  background: "transparent",
                                  color: "var(--accent)",
                                  fontSize: "0.8rem",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {usersData.users.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: "1rem 0.6rem", color: "var(--text-tertiary)", textAlign: "center" }}>
                              No users found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {usersData.pages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.85rem" }}>
                      <button
                        type="button"
                        className="bd-btn"
                        disabled={usersPage <= 1}
                        onClick={() => setUsersPage((p) => p - 1)}
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.82rem" }}
                      >
                        ← Prev
                      </button>
                      <span style={{ color: "var(--text-secondary)" }}>
                        Page {usersPage} of {usersData.pages}
                      </span>
                      <button
                        type="button"
                        className="bd-btn"
                        disabled={usersPage >= usersData.pages}
                        onClick={() => setUsersPage((p) => p + 1)}
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.82rem" }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Delete confirmation modal */}
            {deleteConfirm && (
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 1000,
                  background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
                }}
                onClick={() => !deleteLoading && setDeleteConfirm(null)}
              >
                <div
                  style={{
                    background: "var(--bg-elevated)", borderRadius: "var(--card-radius)",
                    border: "1px solid var(--border-default)", padding: "1.5rem",
                    maxWidth: 420, width: "100%", boxShadow: "var(--shadow-lg)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>Delete account?</h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: "0 0 0.35rem" }}>
                    This will permanently delete:
                  </p>
                  <p style={{ fontWeight: 600, margin: "0 0 0.25rem", wordBreak: "break-all" }}>{deleteConfirm.email ?? deleteConfirm.id}</p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", margin: "0 0 1.25rem" }}>
                    Including all their dumps ({deleteConfirm.dumpCount}), organized items ({deleteConfirm.itemCount}), projects, and sessions. This cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="bd-btn"
                      disabled={deleteLoading}
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteLoading}
                      onClick={() => void deleteUser(deleteConfirm)}
                      style={{
                        padding: "0.4rem 1rem", borderRadius: 8,
                        border: "none", background: "var(--accent)",
                        color: "var(--accent-text)", fontWeight: 600,
                        fontSize: "0.9rem", cursor: deleteLoading ? "wait" : "pointer",
                      }}
                    >
                      {deleteLoading ? "Deleting…" : "Delete permanently"}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
