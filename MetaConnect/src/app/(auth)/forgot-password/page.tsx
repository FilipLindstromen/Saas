"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="card" style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
        Forgot password?
      </h1>
      <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {sent ? (
        <div className="alert alert-success">
          If that email is registered, a reset link has been sent. Check your inbox.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%" }}>
            {loading ? <span className="spinner" /> : "Send reset link"}
          </button>
        </form>
      )}

      <p style={{ textAlign: "center", fontSize: 14, color: "#64748b", marginTop: 20 }}>
        <Link href="/login" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
