"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface MetaPage {
  id: string;
  pageName: string;
  pageId: string;
  igName: string | null;
  webhookSubscribed: boolean;
}

interface SioConnection {
  id: string;
}

function ConnectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");
  const errorParam = searchParams.get("error");

  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [sioConn, setSioConn] = useState<SioConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [sioLoading, setSioLoading] = useState(false);
  const [sioError, setSioError] = useState("");
  const [sioSuccess, setSioSuccess] = useState("");

  const errorMessages: Record<string, string> = {
    meta_denied: "Facebook access was denied. Please try again.",
    no_pages: "No Facebook Pages found. Make sure you manage at least one Page.",
    meta_failed: "Meta connection failed. Please try again.",
  };

  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((data) => {
        setMetaPages(data.metaPages ?? []);
        setSioConn(data.systemeioConnection);
        setLoading(false);
      });
  }, []);

  async function disconnectMeta(pageId: string) {
    if (!confirm("Disconnect this page? All projects using it will be deleted.")) return;
    await fetch(`/api/meta/disconnect?pageId=${pageId}`, { method: "DELETE" });
    setMetaPages((prev) => prev.filter((p) => p.pageId !== pageId));
  }

  async function connectSio(e: React.FormEvent) {
    e.preventDefault();
    setSioLoading(true);
    setSioError("");
    setSioSuccess("");
    const res = await fetch("/api/systemeio/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    setSioLoading(false);
    if (res.ok) {
      setSioSuccess("Systeme.io connected successfully!");
      setSioConn({ id: "new" });
      setApiKey("");
    } else {
      const data = await res.json();
      setSioError(data.error ?? "Connection failed.");
    }
  }

  async function disconnectSio() {
    if (!confirm("Disconnect Systeme.io?")) return;
    await fetch("/api/systemeio/disconnect", { method: "DELETE" });
    setSioConn(null);
    setSioSuccess("");
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
          Connections
        </h1>
        <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>
          Connect your Meta pages and Systeme.io account.
        </p>
      </div>

      {successParam === "meta" && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          Facebook Pages connected successfully!
        </div>
      )}
      {errorParam && (
        <div className="alert alert-error" style={{ marginBottom: 24 }}>
          {errorMessages[errorParam] ?? "An error occurred."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Meta Connection */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#1877F2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 2px", color: "#0f172a" }}>
                  Meta (Facebook & Instagram)
                </h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                  Connect your Facebook Pages to monitor comments and lead forms.
                </p>
              </div>
            </div>
            <a href="/api/meta/oauth" className="btn btn-primary btn-sm">
              + Connect Page
            </a>
          </div>

          {loading ? (
            <div style={{ color: "#94a3b8", fontSize: 14 }}>Loading…</div>
          ) : metaPages.length === 0 ? (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 14,
                border: "1px dashed #e2e8f0",
                borderRadius: 10,
              }}
            >
              No pages connected. Click &ldquo;Connect Page&rdquo; to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {metaPages.map((page) => (
                <div
                  key={page.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#fafafa",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                      {page.pageName}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      Page ID: {page.pageId}
                      {page.igName && ` · Instagram: ${page.igName}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`badge ${page.webhookSubscribed ? "badge-green" : "badge-yellow"}`}>
                      {page.webhookSubscribed ? "Webhook active" : "Webhook pending"}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => disconnectMeta(page.pageId)}
                      style={{ color: "#dc2626" }}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
            }}
          >
            <p style={{ fontSize: 13, color: "#1e40af", margin: 0 }}>
              <strong>Meta App Setup Required:</strong> In your Meta Developer App, set the webhook URL to{" "}
              <code style={{ background: "#dbeafe", padding: "1px 6px", borderRadius: 4 }}>
                https://your-domain.com/api/meta/webhook
              </code>{" "}
              and use your <code style={{ background: "#dbeafe", padding: "1px 6px", borderRadius: 4 }}>META_WEBHOOK_VERIFY_TOKEN</code> as the verify token.
              Subscribe to <strong>feed</strong>, <strong>messages</strong>, and <strong>leadgen</strong> fields.
            </p>
          </div>
        </div>

        {/* Systeme.io Connection */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontWeight: 700,
                fontSize: 18,
                color: "#fff",
              }}
            >
              S
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 2px", color: "#0f172a" }}>
                Systeme.io
              </h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                Sync leads to Systeme.io contacts with tags.
              </p>
            </div>
          </div>

          {sioSuccess && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              {sioSuccess}
            </div>
          )}

          {/* Key type explanation */}
          <div
            style={{
              marginBottom: 20,
              padding: "12px 16px",
              borderRadius: 10,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              fontSize: 13,
              color: "#92400e",
              lineHeight: 1.6,
            }}
          >
            <strong>Use your Public API key</strong> — not the MCP key. The MCP key is only for AI assistants.<br />
            To create one: Systeme.io → <strong>Profile → Public API keys → Create</strong>. Copy the token and paste it below.
          </div>

          {sioConn ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="badge badge-green">Connected</span>
                <span style={{ fontSize: 14, color: "#64748b" }}>Public API key saved securely</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={disconnectSio} style={{ color: "#dc2626" }}>
                Disconnect
              </button>
            </div>
          ) : (
            <form onSubmit={connectSio} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label className="label" htmlFor="apikey">
                  Public API key
                </label>
                <input
                  id="apikey"
                  type="password"
                  className="input"
                  placeholder="Paste your Public API key token here"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
                <span className="helper">
                  Systeme.io → Profile → <strong>Public API keys</strong> → Create → copy the Token
                </span>
              </div>
              {sioError && <div className="alert alert-error">{sioError}</div>}
              <div>
                <button type="submit" className="btn btn-primary" disabled={sioLoading}>
                  {sioLoading ? <span className="spinner" /> : "Connect Systeme.io"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div style={{ color: "#94a3b8" }}>Loading…</div>}>
      <ConnectionsContent />
    </Suspense>
  );
}
