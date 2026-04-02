"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: "1.75rem 1.5rem",
  borderRadius: "var(--card-radius)",
  background: "var(--bg-elevated)",
  boxShadow: "var(--shadow-md)",
  border: "1px solid var(--border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 1rem",
  borderRadius: "var(--button-radius)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 500,
  color: "var(--text-secondary)",
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset link. Open the link from your email or request a new reset from the login page.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Reset failed.");
        setLoading(false);
        return;
      }
      router.replace("/login?reset=success");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        padding: "1.5rem",
      }}
    >
      <div style={cardStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>Set a new password</h1>
          <p style={{ marginTop: "0.4rem", fontSize: "0.95rem", color: "var(--text-secondary)" }}>
            Choose a strong password at least 8 characters long.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="reset-password" style={labelStyle}>
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{ ...inputStyle, marginTop: "0.35rem" }}
            />
          </div>
          <div>
            <label htmlFor="reset-confirm" style={labelStyle}>
              Confirm password
            </label>
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              style={{ ...inputStyle, marginTop: "0.35rem" }}
            />
          </div>
          {error && <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--accent)" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.7rem 1.2rem",
              borderRadius: "var(--button-radius)",
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-text)",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>

        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-tertiary)" }}>
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-primary)",
            color: "var(--text-tertiary)",
          }}
        >
          Loading…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
