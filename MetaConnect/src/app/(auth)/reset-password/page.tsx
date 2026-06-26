"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Reset failed.");
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    }
  }

  if (!token) {
    return (
      <div className="alert alert-error">
        Invalid reset link. Please request a new one.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
        Set new password
      </h1>
      <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
        Enter your new password below.
      </p>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          Password updated! Redirecting to sign in…
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label className="label" htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              className="input"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%" }}>
            {loading ? <span className="spinner" /> : "Update password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
