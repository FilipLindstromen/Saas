"use client";

import { useEffect, useRef } from "react";
import { tickHabitReminders } from "@/lib/habit-reminders";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const INTERVAL_MS = 30_000;

/** Runs while BrainDump is open; shows system notifications at configured local times on selected weekdays. */
export function useHabitRemindersTick(t: TFn) {
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const run = () => {
      tickHabitReminders({
        title: tRef.current("habitReminder.notificationTitle"),
        body: tRef.current("habitReminder.notificationBody"),
      });
    };
    run();
    const id = window.setInterval(run, INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", run);
    };
  }, []);
}
