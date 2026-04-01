"use client";

import { useI18n } from "@/lib/i18n";
import type { DumpStreakState } from "@/lib/dump-streak";
import { streakBadgeStatuses, streakLevelProgress } from "@/lib/streak-gamification";

interface StreaksModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: DumpStreakState;
}

export function StreaksModal({ isOpen, onClose, state }: StreaksModalProps) {
  const { t } = useI18n();
  const { level, inLevel, need } = streakLevelProgress(state.totalOrganizedDumps);
  const badges = streakBadgeStatuses(state);
  const progressPct = need > 0 ? Math.min(100, Math.round((inLevel / need) * 100)) : 0;

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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bd-streaks-modal-head">
          <h2 id="bd-streaks-title" className="bd-streaks-modal-title">
            {t("streaks.title")}
          </h2>
          <button type="button" className="bd-btn bd-streaks-modal-close" onClick={onClose} aria-label={t("center.close")}>
            ×
          </button>
        </div>
        <p className="bd-streaks-modal-intro">{t("streaks.intro")}</p>

        <div className="bd-streaks-level-block">
          <div className="bd-streaks-level-row">
            <span className="bd-streaks-level-label">{t("streaks.levelHeading")}</span>
            <span className="bd-streaks-level-value">{level}</span>
          </div>
          <div
            className="bd-streaks-level-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={need}
            aria-valuenow={inLevel}
            aria-label={t("streaks.levelProgressAria", { current: inLevel, need })}
          >
            <div className="bd-streaks-level-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="bd-streaks-stats-grid">
          <div className="bd-streaks-stat-card">
            <div className="bd-streaks-stat-label">{t("streaks.current")}</div>
            <div className="bd-streaks-stat-value bd-streaks-stat-value--accent">{state.currentStreak}</div>
            <div className="bd-streaks-stat-unit">{t("streaks.days")}</div>
          </div>
          <div className="bd-streaks-stat-card">
            <div className="bd-streaks-stat-label">{t("streaks.best")}</div>
            <div className="bd-streaks-stat-value">{state.longestStreak}</div>
            <div className="bd-streaks-stat-unit">{t("streaks.days")}</div>
          </div>
        </div>

        <div className="bd-streaks-total">{t("streaks.totalOrganized", { n: state.totalOrganizedDumps })}</div>

        <h3 className="bd-streaks-badges-heading">{t("streaks.badgesHeading")}</h3>
        <ul className="bd-streaks-badge-grid">
          {badges.map((b) => (
            <li key={b.id}>
              <BadgeTile unlocked={b.unlocked} title={t(`streaks.badge.${b.id}`)} lockedLabel={t("streaks.badgeLocked")} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BadgeTile({ unlocked, title, lockedLabel }: { unlocked: boolean; title: string; lockedLabel: string }) {
  return (
    <div
      className={`bd-streak-mint-badge${unlocked ? " bd-streak-mint-badge--on" : ""}`}
      title={unlocked ? title : `${title} — ${lockedLabel}`}
      aria-label={unlocked ? title : `${title}, ${lockedLabel}`}
    >
      <span className="bd-streak-mint-badge-mark" aria-hidden>
        {unlocked ? "✓" : "·"}
      </span>
      <span className="bd-streak-mint-badge-title">{title}</span>
    </div>
  );
}
