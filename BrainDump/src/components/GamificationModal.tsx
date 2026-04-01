"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import type { GamificationClientPayload } from "@/lib/gamification";

interface GamificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function TrackCard({
  label,
  track,
  progressAria,
}: {
  label: string;
  track: GamificationClientPayload["capture"];
  progressAria: string;
}) {
  const { t } = useI18n();
  return (
    <div className="bd-gamification-track">
      <div className="bd-gamification-track-head">
        <span className="bd-gamification-track-label">{label}</span>
        <span className="bd-gamification-track-meta">
          {t("gamification.levelShort", { n: track.level })} · {t(track.rankKey)}
        </span>
      </div>
      <div
        className="bd-gamification-track-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={track.xpForNextLevel}
        aria-valuenow={track.xpIntoLevel}
        aria-label={progressAria}
      >
        <div className="bd-gamification-track-fill" style={{ width: `${track.progressPct}%` }} />
      </div>
      <div className="bd-gamification-track-foot">
        <span>
          {t("gamification.xpStat", { xp: track.xp })}
        </span>
        <span className="bd-gamification-track-count">
          {t("gamification.countLabel", { n: track.count })}
        </span>
      </div>
    </div>
  );
}

export function GamificationModal({ isOpen, onClose }: GamificationModalProps) {
  const { t } = useI18n();
  const { status } = useSession();
  const [data, setData] = useState<Omit<GamificationClientPayload, "celebrate"> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (status !== "authenticated") {
      setData(null);
      setLoadError(null);
      return;
    }
    setLoadError(null);
    setData(null);
    (async () => {
      try {
        const res = await fetch("/api/gamification");
        const json = (await res.json()) as { gamification?: Omit<GamificationClientPayload, "celebrate">; error?: string };
        if (!res.ok) {
          setLoadError(json.error || t("gamification.loadError"));
          return;
        }
        if (json.gamification) setData(json.gamification);
      } catch {
        setLoadError(t("gamification.loadError"));
      }
    })();
  }, [isOpen, status, t]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-gamification-title"
      className="bd-modal-backdrop bd-gamification-modal-backdrop"
      onClick={onClose}
    >
      <div className="bd-modal-panel bd-gamification-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bd-gamification-modal-head">
          <h2 id="bd-gamification-title" className="bd-gamification-modal-title">
            {t("gamification.title")}
          </h2>
          <button type="button" className="bd-btn bd-gamification-modal-close" onClick={onClose} aria-label={t("center.close")}>
            ×
          </button>
        </div>
        <p className="bd-gamification-modal-intro">{t("gamification.intro")}</p>

        {status !== "authenticated" ? (
          <p className="bd-gamification-modal-hint">{t("gamification.signInHint")}</p>
        ) : loadError ? (
          <p className="bd-gamification-modal-error">{loadError}</p>
        ) : !data ? (
          <p className="bd-gamification-modal-hint">{t("gamification.loading")}</p>
        ) : (
          <div className="bd-gamification-tracks">
            <TrackCard
              label={t("gamification.trackCapture")}
              track={data.capture}
              progressAria={t("gamification.progressAria", {
                current: data.capture.xpIntoLevel,
                need: data.capture.xpForNextLevel,
              })}
            />
            <TrackCard
              label={t("gamification.trackTasks")}
              track={data.task}
              progressAria={t("gamification.progressAria", {
                current: data.task.xpIntoLevel,
                need: data.task.xpForNextLevel,
              })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
