"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import type { GamificationClientPayload } from "@/lib/gamification";
import { BRAINDUMP_GAMIFICATION_EVENT } from "@/lib/gamification-client";

function buildToastLines(payload: GamificationClientPayload, t: (k: string, v?: Record<string, string | number>) => string): string[] {
  const c = payload.celebrate;
  if (!c) return [];

  const lines: string[] = [];

  if (c.levelUpCapture) {
    lines.push(
      t("gamification.toast.levelUpCapture", {
        level: payload.capture.level,
        rank: t(payload.capture.rankKey),
      })
    );
  } else if (c.dumpCapture) {
    const pool = ["gamification.feedback.dump.a", "gamification.feedback.dump.b", "gamification.feedback.dump.c"];
    lines.push(t(pool[Math.floor(Math.random() * pool.length)]));
  }

  if (c.levelUpTask) {
    lines.push(
      t("gamification.toast.levelUpTask", {
        level: payload.task.level,
        rank: t(payload.task.rankKey),
      })
    );
  } else if (c.taskDone) {
    const pool = ["gamification.feedback.task.a", "gamification.feedback.task.b", "gamification.feedback.task.c"];
    lines.push(t(pool[Math.floor(Math.random() * pool.length)]));
  }

  return lines.filter(Boolean);
}

export function GamificationToastHost() {
  const { t } = useI18n();
  const { status } = useSession();
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<GamificationClientPayload>;
      const lines = buildToastLines(e.detail, t);
      if (lines.length === 0) return;
      setQueue((q) => [...q, lines.join("\n\n")]);
    };
    window.addEventListener(BRAINDUMP_GAMIFICATION_EVENT, handler);
    return () => window.removeEventListener(BRAINDUMP_GAMIFICATION_EVENT, handler);
  }, [t, status]);

  useEffect(() => {
    if (queue.length === 0) return;
    const id = window.setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, 4800);
    return () => window.clearTimeout(id);
  }, [queue]);

  if (status !== "authenticated" || queue.length === 0) return null;

  return (
    <div className="bd-gamification-toast-host" aria-live="polite">
      <div className="bd-gamification-toast">
        <button
          type="button"
          className="bd-gamification-toast-dismiss"
          aria-label={t("center.close")}
          onClick={() => setQueue((q) => q.slice(1))}
        >
          ×
        </button>
        <div className="bd-gamification-toast-body">{queue[0]}</div>
      </div>
    </div>
  );
}
