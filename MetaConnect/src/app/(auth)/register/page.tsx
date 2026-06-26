"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import Link from "next/link";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => {
    getProviders().then((providers) => {
      setGoogleAvailable(Boolean(providers?.google));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Registration failed.");
    } else {
      router.push("/login?registered=1");
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="card" style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
        Create account
      </h1>
      <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
        Get started with MetaConnect
      </p>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Google sign-up */}
      {googleAvailable && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontSize: 14,
              fontWeight: 500,
              color: "#374151",
              cursor: googleLoading ? "not-allowed" : "pointer",
              opacity: googleLoading ? 0.7 : 1,
              transition: "background 150ms",
              minHeight: 44,
              marginBottom: 4,
            }}
          >
            {googleLoading ? (
              <span className="spinner" style={{ borderTopColor: "#374151" }} />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "4px 0",
            }}
          >
            <hr className="divider" style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>or sign up with email</span>
            <hr className="divider" style={{ flex: 1 }} />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: googleAvailable ? 4 : 0 }}>
        <div className="field">
          <label className="label" htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            className="input"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

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
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading}
          style={{ width: "100%", marginTop: 4 }}
        >
          {loading ? <span className="spinner" /> : "Create account"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 14, color: "#64748b", marginTop: 20 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
