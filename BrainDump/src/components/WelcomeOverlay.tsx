"use client";

import { useEffect, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";

const WELCOME_DONE_KEY = "braindump-welcome-done";

function hasSeenWelcome(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return Boolean(localStorage.getItem(WELCOME_DONE_KEY));
  } catch {
    return true;
  }
}

function markWelcomeDone(): void {
  try {
    localStorage.setItem(WELCOME_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

const LANGUAGES: { value: Locale; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "sv", label: "Svenska", native: "Swedish" },
];

export function WelcomeOverlay() {
  const { locale, setLocale } = useI18n();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Locale>(locale);

  useEffect(() => {
    if (!hasSeenWelcome()) setVisible(true);
  }, []);

  // Keep selected in sync if locale was loaded from storage after mount
  useEffect(() => {
    setSelected(locale);
  }, [locale]);

  if (!visible) return null;

  const confirm = () => {
    setLocale(selected);
    markWelcomeDone();
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        className="bd-panel"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "2rem 1.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          borderRadius: "var(--card-radius)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-welcome-title"
      >
        {/* Logo / wordmark */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "var(--accent)",
              marginBottom: "0.75rem",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text, #fff)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <h1
            id="bd-welcome-title"
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
            }}
          >
            Welcome
          </h1>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Choose the language you&apos;d like to use.
          </p>
        </div>

        {/* Language selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => setSelected(lang.value)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.7rem 1rem",
                borderRadius: "var(--card-radius, 10px)",
                border: selected === lang.value
                  ? "2px solid var(--accent)"
                  : "2px solid var(--border-default)",
                background: selected === lang.value
                  ? "color-mix(in srgb, var(--accent) 10%, var(--bg-primary))"
                  : "var(--bg-primary)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: selected === lang.value ? 600 : 400,
                transition: "border-color 0.15s, background 0.15s",
                textAlign: "left",
              }}
              aria-pressed={selected === lang.value}
            >
              <span>{lang.native}</span>
              {selected === lang.value && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Confirm button */}
        <button
          type="button"
          className="bd-btn bd-btn-primary"
          style={{ width: "100%", padding: "0.7rem", fontSize: "0.95rem", fontWeight: 600, color: "var(--accent-text)" }}
          onClick={confirm}
        >
          Get started
        </button>
      </div>
    </div>
  );
}
