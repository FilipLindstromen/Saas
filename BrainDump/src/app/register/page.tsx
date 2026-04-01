"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

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

export default function RegisterPage() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.errorPasswordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.errorPasswordMin8"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? t("auth.registrationFailed"));
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError(t("auth.errorGeneric"));
    }
    setLoading(false);
  };

  if (success) {
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
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>{t("auth.accountCreatedTitle")}</h1>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-secondary)" }}>
            {t("auth.accountCreatedBody")}
          </p>
          <Link href="/login" className="bd-btn bd-btn-primary" style={{ textAlign: "center", textDecoration: "none" }}>
            {t("auth.goToSignIn")}
          </Link>
        </div>
      </div>
    );
  }

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
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>{t("auth.createAccount")}</h1>
          <p style={{ marginTop: "0.4rem", fontSize: "0.95rem", color: "var(--text-secondary)" }}>
            {t("auth.registrationSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="reg-name" style={labelStyle}>
              {t("auth.fieldName")}
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...inputStyle, marginTop: "0.35rem" }}
              placeholder={t("auth.placeholderYourName")}
            />
          </div>
          <div>
            <label htmlFor="reg-email" style={labelStyle}>
              {t("auth.fieldEmail")}
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ ...inputStyle, marginTop: "0.35rem" }}
              placeholder={t("auth.placeholderEmailExample")}
            />
          </div>
          <div>
            <label htmlFor="reg-password" style={labelStyle}>
              {t("auth.fieldPassword")}
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{ ...inputStyle, marginTop: "0.35rem" }}
              placeholder={t("auth.placeholderPasswordMin8")}
            />
          </div>
          <div>
            <label htmlFor="reg-confirm" style={labelStyle}>
              {t("auth.fieldConfirmPassword")}
            </label>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              style={{ ...inputStyle, marginTop: "0.35rem" }}
            />
          </div>
          {error ? (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--accent)" }}>{error}</p>
          ) : null}
          <button type="submit" className="bd-btn bd-btn-primary" disabled={loading}>
            {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
          </button>
        </form>

        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-tertiary)" }}>
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
