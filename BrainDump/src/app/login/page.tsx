"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

const overlayBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: "var(--bd-z-modal)",
  background: "rgba(0, 0, 0, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.25rem",
  backdropFilter: "blur(4px)",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSuccessBanner, setResetSuccessBanner] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [forgotSendMeta, setForgotSendMeta] = useState<{
    attempted: boolean;
    sent: boolean;
    configured: boolean;
  } | null>(null);

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setResetSuccessBanner(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        remember: remember ? "true" : "false",
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      if (res?.ok) {
        window.location.href = "/";
        return;
      }
      setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const openForgot = () => {
    setForgotEmail(email.trim());
    setForgotMessage("");
    setForgotError("");
    setDevResetUrl(null);
    setForgotSendMeta(null);
    setForgotOpen(true);
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setDevResetUrl(null);
    setForgotSendMeta(null);
    const em = forgotEmail.trim().toLowerCase();
    if (!em) {
      setForgotError("Enter your email address.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const data = await res.json();
      if (!res.ok && typeof data.error === "string") {
        setForgotError(data.error);
        setForgotLoading(false);
        return;
      }
      if (typeof data.message === "string") {
        setForgotMessage(data.message);
      } else {
        setForgotMessage("If that account can receive mail, we sent password reset instructions.");
      }
      if (typeof data.devResetUrl === "string") {
        setDevResetUrl(data.devResetUrl);
      }
      setForgotSendMeta({
        attempted: Boolean(data.attemptedEmailDelivery),
        sent: Boolean(data.emailSent),
        configured: Boolean(data.emailDeliveryConfigured),
      });
    } catch {
      setForgotError("Request failed. Try again.");
    }
    setForgotLoading(false);
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
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>BrainDump</h1>
          <p style={{ marginTop: "0.4rem", fontSize: "0.95rem", color: "var(--text-secondary)" }}>
            Sign in to keep your dumps, projects and organized items private.
          </p>
        </div>

        {resetSuccessBanner && (
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              padding: "0.65rem 0.75rem",
              borderRadius: "var(--button-radius)",
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            Your password was updated. You can sign in below.
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="login-email" style={labelStyle}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ ...inputStyle, marginTop: "0.35rem" }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <label htmlFor="login-password" style={labelStyle}>
                Password
              </label>
              <button
                type="button"
                onClick={openForgot}
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
              >
                Forgot password?
              </button>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ ...inputStyle, marginTop: "0.35rem" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            Remember me (stay signed in for 30 days)
          </label>
          {error && (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--accent)" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.7rem 1.2rem",
              borderRadius: "var(--button-radius)",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-tertiary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>

      {forgotOpen && (
        <div
          style={overlayBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setForgotOpen(false);
          }}
        >
          <div
            style={{
              ...cardStyle,
              maxWidth: 400,
              position: "relative",
              zIndex: 1001,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
              <h2 id="forgot-password-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>
                Reset password
              </h2>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                aria-label="Close"
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: "var(--button-radius)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              Enter your email and we&apos;ll send you a link to choose a new password.
            </p>

            {!forgotMessage ? (
              <form onSubmit={submitForgot} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label htmlFor="forgot-email" style={labelStyle}>
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    style={{ ...inputStyle, marginTop: "0.35rem" }}
                    placeholder="you@example.com"
                  />
                </div>
                {forgotError && (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--accent)" }}>{forgotError}</p>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    padding: "0.65rem 1rem",
                    borderRadius: "var(--button-radius)",
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: forgotLoading ? "not-allowed" : "pointer",
                    opacity: forgotLoading ? 0.85 : 1,
                  }}
                >
                  {forgotLoading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>{forgotMessage}</p>
                {forgotSendMeta?.attempted && !forgotSendMeta.sent && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.85rem",
                      padding: "0.6rem 0.7rem",
                      borderRadius: "var(--button-radius)",
                      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {forgotSendMeta.configured
                      ? "We could not send the email (the mail provider rejected the request). Try again in a few minutes or contact support."
                      : "Email is not configured on this server: add RESEND_API_KEY and a verified EMAIL_FROM to the environment so reset links can be delivered."}
                  </p>
                )}
                {devResetUrl && (
                  <div
                    style={{
                      padding: "0.65rem 0.75rem",
                      borderRadius: "var(--button-radius)",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      fontSize: "0.75rem",
                      wordBreak: "break-all",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Development only (no email configured):
                    </strong>
                    <a href={devResetUrl} style={{ color: "var(--accent)" }}>
                      {devResetUrl}
                    </a>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(false);
                    setForgotMessage("");
                    setDevResetUrl(null);
                    setForgotSendMeta(null);
                  }}
                  style={{
                    padding: "0.65rem 1rem",
                    borderRadius: "var(--button-radius)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
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
      <LoginContent />
    </Suspense>
  );
}
