"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  defaultHabitReminderConfig,
  loadHabitReminderConfig,
  normalizeHabitReminderConfig,
  saveHabitReminderConfig,
  WEEKDAY_ORDER_MON_FIRST,
  type HabitReminderConfig,
} from "@/lib/habit-reminders";

const MAX_TIMES = 8;

const DAY_MSG_KEYS = [
  "habitReminder.dayShort.sun",
  "habitReminder.dayShort.mon",
  "habitReminder.dayShort.tue",
  "habitReminder.dayShort.wed",
  "habitReminder.dayShort.thu",
  "habitReminder.dayShort.fri",
  "habitReminder.dayShort.sat",
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function BrainDumpHabitReminderModal({ isOpen, onClose }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<HabitReminderConfig>(() => defaultHabitReminderConfig());

  useEffect(() => {
    if (!isOpen) return;
    setDraft(normalizeHabitReminderConfig(loadHabitReminderConfig()));
  }, [isOpen]);

  const setDay = useCallback((getDayIndex: number, on: boolean) => {
    setDraft((d) => {
      const days = [...d.days];
      days[getDayIndex] = on;
      return { ...d, days };
    });
  }, []);

  const setTimeAt = useCallback((index: number, value: string) => {
    setDraft((d) => {
      const times = [...d.times];
      times[index] = value;
      return { ...d, times };
    });
  }, []);

  const addTime = useCallback(() => {
    setDraft((d) => {
      if (d.times.length >= MAX_TIMES) return d;
      const last = d.times[d.times.length - 1] ?? "09:00";
      return { ...d, times: [...d.times, last] };
    });
  }, []);

  const removeTime = useCallback((index: number) => {
    setDraft((d) => {
      if (d.times.length <= 1) return d;
      const times = d.times.filter((_, i) => i !== index);
      return { ...d, times };
    });
  }, []);

  const applyPresetWeekdays = useCallback(() => {
    setDraft((d) => ({
      ...d,
      days: [false, true, true, true, true, true, false],
    }));
  }, []);

  const applyPresetEveryDay = useCallback(() => {
    setDraft((d) => ({
      ...d,
      days: [true, true, true, true, true, true, true],
    }));
  }, []);

  const toggleEnabled = useCallback((on: boolean) => {
    setDraft((d) => ({ ...d, enabled: on }));
    if (on && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const handleSave = useCallback(() => {
    const normalized = normalizeHabitReminderConfig(draft);
    const hasDay = normalized.days.some(Boolean);
    const toSave: HabitReminderConfig = {
      ...normalized,
      enabled: normalized.enabled && hasDay && normalized.times.length > 0,
    };
    saveHabitReminderConfig(toSave);
    setDraft(toSave);
    onClose();
  }, [draft, onClose]);

  if (!isOpen) return null;

  const perm =
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";
  const permHint =
    perm === "denied"
      ? t("habitReminder.permissionDenied")
      : perm === "default"
        ? t("habitReminder.permissionDefault")
        : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-habit-reminder-title"
      className="bd-modal-backdrop bd-habit-reminder-modal-backdrop"
      onClick={onClose}
    >
      <div className="bd-modal-panel bd-habit-reminder-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bd-habit-reminder-head">
          <h2 id="bd-habit-reminder-title" className="bd-habit-reminder-title">
            {t("habitReminder.title")}
          </h2>
          <button type="button" className="bd-btn bd-habit-reminder-close" onClick={onClose} aria-label={t("center.close")}>
            ×
          </button>
        </div>
        <p className="bd-habit-reminder-intro">{t("habitReminder.intro")}</p>

        <label className="bd-habit-reminder-toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
          />
          <span>{t("habitReminder.enable")}</span>
        </label>

        {permHint ? <p className="bd-habit-reminder-hint">{permHint}</p> : null}

        <div className="bd-habit-reminder-section">
          <div className="bd-habit-reminder-section-head">
            <span className="bd-habit-reminder-label">{t("habitReminder.daysLabel")}</span>
            <div className="bd-habit-reminder-presets">
              <button type="button" className="bd-habit-reminder-chip" onClick={applyPresetWeekdays}>
                {t("habitReminder.presetWeekdays")}
              </button>
              <button type="button" className="bd-habit-reminder-chip" onClick={applyPresetEveryDay}>
                {t("habitReminder.presetEveryDay")}
              </button>
            </div>
          </div>
          <div className="bd-habit-reminder-days" role="group" aria-label={t("habitReminder.daysLabel")}>
            {WEEKDAY_ORDER_MON_FIRST.map((getDayIdx) => {
              const on = draft.days[getDayIdx] ?? false;
              const label = t(DAY_MSG_KEYS[getDayIdx]!);
              return (
                <button
                  key={getDayIdx}
                  type="button"
                  className={`bd-habit-reminder-day${on ? " bd-habit-reminder-day--on" : ""}`}
                  onClick={() => setDay(getDayIdx, !on)}
                  aria-pressed={on}
                  aria-label={label}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bd-habit-reminder-section">
          <span className="bd-habit-reminder-label">{t("habitReminder.timesLabel")}</span>
          <ul className="bd-habit-reminder-times">
            {draft.times.map((time, i) => (
              <li key={i} className="bd-habit-reminder-time-row">
                <input
                  type="time"
                  className="bd-habit-reminder-time-input"
                  value={time}
                  onChange={(e) => setTimeAt(i, e.target.value)}
                  aria-label={t("habitReminder.timeSlotAria", { n: i + 1 })}
                />
                {draft.times.length > 1 ? (
                  <button
                    type="button"
                    className="bd-habit-reminder-remove"
                    onClick={() => removeTime(i)}
                    aria-label={t("habitReminder.removeTime")}
                  >
                    −
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {draft.times.length < MAX_TIMES ? (
            <button type="button" className="bd-habit-reminder-add" onClick={addTime}>
              + {t("habitReminder.addTime")}
            </button>
          ) : null}
        </div>

        <div className="bd-habit-reminder-actions">
          <button type="button" className="bd-btn bd-habit-reminder-save" onClick={handleSave}>
            {t("habitReminder.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
