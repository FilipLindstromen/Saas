"use client";

import { useEffect, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";

const WELCOME_DONE_KEY = "braindump-welcome-done";
export const WELCOME_COMPLETE_EVENT = "braindump-welcome-complete";

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

const STEPS = ["language", "howItWorks", "ready"] as const;
type Step = (typeof STEPS)[number];

export function WelcomeOverlay() {
  const { t, locale, setLocale } = useI18n();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("language");
  const [selected, setSelected] = useState<Locale>(locale);

  useEffect(() => {
    if (!hasSeenWelcome()) setVisible(true);
  }, []);

  useEffect(() => {
    setSelected(locale);
  }, [locale]);

  if (!visible) return null;

  const finish = () => {
    setLocale(selected);
    markWelcomeDone();
    setVisible(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(WELCOME_COMPLETE_EVENT));
    }
  };

  const next = () => {
    if (step === "language") {
      setLocale(selected);
      setStep("howItWorks");
      return;
    }
    if (step === "howItWorks") {
      setStep("ready");
      return;
    }
    finish();
  };

  const back = () => {
    if (step === "howItWorks") setStep("language");
    else if (step === "ready") setStep("howItWorks");
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
        className="bd-panel bd-welcome-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-welcome-title"
      >
        <div className="bd-welcome-steps" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`bd-welcome-step-dot${STEPS.indexOf(step) >= i ? " bd-welcome-step-dot--active" : ""}`}
            />
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <div className="bd-welcome-logo" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text, #fff)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <h1 id="bd-welcome-title" className="bd-welcome-title">
            {step === "language" && t("welcome.titleLanguage")}
            {step === "howItWorks" && t("welcome.titleHow")}
            {step === "ready" && t("welcome.titleReady")}
          </h1>
          <p className="bd-welcome-subtitle">
            {step === "language" && t("welcome.subtitleLanguage")}
            {step === "howItWorks" && t("welcome.subtitleHow")}
            {step === "ready" && t("welcome.subtitleReady")}
          </p>
        </div>

        {step === "language" && (
          <div className="bd-welcome-lang-list">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => setSelected(lang.value)}
                className={`bd-welcome-lang-btn${selected === lang.value ? " bd-welcome-lang-btn--selected" : ""}`}
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
        )}

        {step === "howItWorks" && (
          <ol className="bd-welcome-flow">
            <li>{t("welcome.flow1")}</li>
            <li>{t("welcome.flow2")}</li>
            <li>{t("welcome.flow3")}</li>
          </ol>
        )}

        {step === "ready" && (
          <p className="bd-welcome-ready-note">{t("welcome.readyNote")}</p>
        )}

        <div className="bd-welcome-actions">
          {step !== "language" ? (
            <button type="button" className="bd-btn" onClick={back}>
              {t("welcome.back")}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="bd-btn bd-btn-primary" onClick={next}>
            {step === "ready" ? t("welcome.getStarted") : t("welcome.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
