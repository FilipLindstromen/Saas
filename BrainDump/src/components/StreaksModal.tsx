"use client";

import { useI18n } from "@/lib/i18n";
import type { DumpStreakState } from "@/lib/dump-streak";

interface StreaksModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: DumpStreakState;
}

export function StreaksModal({ isOpen, onClose, state }: StreaksModalProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-streaks-title"
      className="bd-modal-backdrop bd-streaks-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bd-modal-panel bd-streaks-modal-panel"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--card-radius)",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "var(--shadow-xl)",
          padding: "1.25rem 1.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem" }}>
          <h2 id="bd-streaks-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {t("streaks.title")}
          </h2>
          <button type="button" className="bd-btn" onClick={onClose} style={{ padding: "0.25rem 0.45rem", minWidth: 44, minHeight: 44 }} aria-label={t("scope.cancel")}>
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          {t("streaks.intro")}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-secondary)",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", fontWeight: 500 }}>{t("streaks.current")}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent)", lineHeight: 1.2 }}>{state.currentStreak}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.2rem" }}>{t("streaks.days")}</div>
          </div>
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-secondary)",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", fontWeight: 500 }}>{t("streaks.best")}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{state.longestStreak}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.2rem" }}>{t("streaks.days")}</div>
          </div>
        </div>
        <div
          style={{
            padding: "0.65rem 0.85rem",
            borderRadius: "var(--button-radius)",
            background: "var(--bg-tertiary)",
            fontSize: "0.8125rem",
            color: "var(--text-secondary)",
          }}
        >
          {t("streaks.totalOrganized", { n: state.totalOrganizedDumps })}
        </div>
      </div>
    </div>
  );
}
