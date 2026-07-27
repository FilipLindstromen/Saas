"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { loadShowEntryTitles, saveShowEntryTitles } from "@/lib/entry-display-settings";
import { loadShowDumpFace, saveShowDumpFace } from "@/lib/dump-face-settings";
import { loadSoundEffectsEnabled, saveSoundEffectsEnabled } from "@/lib/sound-effects-settings";
import {
  fetchGoogleCalendarEvents,
  importCalendarEventsToBrainDump,
  parseIcsCalendarEvents,
} from "@/lib/calendar-import-braindump";
import {
  AppleCalendarPermissionError,
  fetchAppleCalendarEventsForImport,
  isIosNativeCalendarImportAvailable,
} from "@/lib/apple-calendar-native";
import {
  clearGoogleCalendarAccessToken,
  loadGoogleCalendarAccessToken,
  saveGoogleCalendarAccessToken,
} from "@/lib/google-calendar-token";
import { scheduleClientPreferencesUpload } from "@/lib/client-preferences-sync";
import { applyTextSizeOnLoad, loadTextSize, saveTextSize, TEXT_SIZE_OPTIONS } from "@/lib/text-size-settings";

const GOOGLE_CALENDAR_SYNC_KEY = "braindump_google_calendar_sync";
const GOOGLE_CALENDAR_ID_KEY = "braindump_google_calendar_id";
const GOOGLE_CALENDAR_SUMMARY_KEY = "braindump_google_calendar_summary";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export function loadGoogleCalendarSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GOOGLE_CALENDAR_SYNC_KEY) === "true";
  } catch {}
  return false;
}

function saveGoogleCalendarSync(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GOOGLE_CALENDAR_SYNC_KEY, enabled ? "true" : "false");
    scheduleClientPreferencesUpload();
  } catch (e) {
    console.warn("Failed to save Google Calendar sync preference", e);
  }
}


export function loadGoogleCalendarId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(GOOGLE_CALENDAR_ID_KEY);
  } catch {}
  return null;
}

function loadGoogleCalendarSummary(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(GOOGLE_CALENDAR_SUMMARY_KEY) ?? "";
  } catch {}
  return "";
}

function saveGoogleCalendarSelection(id: string, summary: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GOOGLE_CALENDAR_ID_KEY, id);
    localStorage.setItem(GOOGLE_CALENDAR_SUMMARY_KEY, summary);
    scheduleClientPreferencesUpload();
  } catch (e) {
    console.warn("Failed to save calendar selection", e);
  }
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CalendarOption {
  id: string;
  summary: string;
  primary?: boolean;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t, locale, setLocale } = useI18n();
  const [textSize, setTextSize] = useState("medium");
  const [googleCalendarSync, setGoogleCalendarSync] = useState(false);
  const [serverClientId, setServerClientId] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [selectedCalendarSummary, setSelectedCalendarSummary] = useState("");
  const [calendarList, setCalendarList] = useState<CalendarOption[]>([]);
  const [calendarListLoading, setCalendarListLoading] = useState(false);
  const [calendarListError, setCalendarListError] = useState<string | null>(null);
  const [deleteOverlayOpen, setDeleteOverlayOpen] = useState(false);
  const [showEntryTitles, setShowEntryTitles] = useState(true);
  const [showDumpFace, setShowDumpFace] = useState(true);
  const [soundEffects, setSoundEffects] = useState(false);
  const [appleCalendarStepsOpen, setAppleCalendarStepsOpen] = useState(false);
  const [appleIcsAdvancedOpen, setAppleIcsAdvancedOpen] = useState(false);
  const [calendarImportBusy, setCalendarImportBusy] = useState(false);
  const [calendarImportMessage, setCalendarImportMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const icsFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    applyTextSizeOnLoad();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTextSize(loadTextSize());
      setShowEntryTitles(loadShowEntryTitles());
      setShowDumpFace(loadShowDumpFace());
      setSoundEffects(loadSoundEffectsEnabled());
      setGoogleCalendarSync(loadGoogleCalendarSync());
      setSelectedCalendarId(loadGoogleCalendarId());
      setSelectedCalendarSummary(loadGoogleCalendarSummary());
      setCalendarList([]);
      setCalendarListError(null);
      setDeleteOverlayOpen(false);
      setAppleCalendarStepsOpen(false);
      setAppleIcsAdvancedOpen(false);
      setCalendarImportBusy(false);
      setCalendarImportMessage(null);
    }
  }, [isOpen]);

  const runGoogleImportIntoBrainDump = useCallback(async () => {
    setCalendarImportMessage(null);
    const { token, expired } = loadGoogleCalendarAccessToken();
    const calId = selectedCalendarId ?? loadGoogleCalendarId();
    if (!token || expired) {
      setCalendarImportMessage({ tone: "err", text: t("settings.googleCalendarNoToken") });
      return;
    }
    if (!calId) {
      setCalendarImportMessage({ tone: "err", text: t("settings.googleCalendarNoCalendar") });
      return;
    }
    setCalendarImportBusy(true);
    try {
      const events = await fetchGoogleCalendarEvents(token, calId);
      const n = await importCalendarEventsToBrainDump({
        domain: "personal",
        category: "thoughts",
        events,
      });
      setCalendarImportMessage({ tone: "ok", text: t("settings.googleCalendarImportDone", { count: n }) });
    } catch {
      setCalendarImportMessage({ tone: "err", text: t("settings.googleCalendarImportError") });
    } finally {
      setCalendarImportBusy(false);
    }
  }, [selectedCalendarId, t]);

  const runIcsImportIntoBrainDump = useCallback(
    async (file: File) => {
      setCalendarImportMessage(null);
      setCalendarImportBusy(true);
      try {
        const text = await file.text();
        const events = parseIcsCalendarEvents(text);
        const n = await importCalendarEventsToBrainDump({
          domain: "personal",
          category: "thoughts",
          events,
        });
        setCalendarImportMessage({ tone: "ok", text: t("settings.appleCalendarImportDone", { count: n }) });
      } catch {
        setCalendarImportMessage({ tone: "err", text: t("settings.appleCalendarImportError") });
      } finally {
        setCalendarImportBusy(false);
      }
    },
    [t]
  );

  const runAppleNativeImport = useCallback(async () => {
    setCalendarImportMessage(null);
    setCalendarImportBusy(true);
    try {
      const events = await fetchAppleCalendarEventsForImport();
      const n = await importCalendarEventsToBrainDump({
        domain: "personal",
        category: "thoughts",
        events,
      });
      setCalendarImportMessage({ tone: "ok", text: t("settings.appleCalendarImportNativeDone", { count: n }) });
    } catch (e) {
      if (e instanceof AppleCalendarPermissionError) {
        setCalendarImportMessage({ tone: "err", text: t("settings.appleCalendarPermissionDenied") });
      } else {
        setCalendarImportMessage({ tone: "err", text: t("settings.appleCalendarImportNativeError") });
      }
    } finally {
      setCalendarImportBusy(false);
    }
  }, [t]);

  const openGoogleOAuth = useCallback(async () => {
    setCalendarListError(null);
    let clientId = serverClientId;
    if (!clientId) {
      setConnectBusy(true);
      try {
        const res = await fetch("/api/google-calendar-oauth-config");
        const data = (await res.json()) as { configured: boolean; clientId: string | null };
        if (data.configured && data.clientId) {
          clientId = data.clientId;
          setServerClientId(clientId);
        }
      } catch {
        // ignore network error
      } finally {
        setConnectBusy(false);
      }
    }
    if (!clientId) {
      setCalendarListError("Google Calendar is not configured on this server.");
      return;
    }
    const redirectUri = `${window.location.origin}/google-calendar-callback`;
    const state = "braindump-calendar-" + Date.now();
    sessionStorage.setItem("braindump_google_oauth_state", state);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: GOOGLE_CALENDAR_SCOPE,
      state,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.open(url, "braindump-google-oauth", "width=520,height=600,scrollbars=yes");
  }, [serverClientId]);

  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "braindump-google-calendar-token" && e.data?.accessToken) {
        saveGoogleCalendarAccessToken(
          e.data.accessToken as string,
          typeof e.data.expiresIn === "number" ? e.data.expiresIn : undefined
        );
        setGoogleCalendarSync(true);
        saveGoogleCalendarSync(true);
        setCalendarListLoading(true);
        setCalendarListError(null);
        fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
          headers: { Authorization: `Bearer ${e.data.accessToken}` },
        })
          .then((r) => {
            if (!r.ok) throw new Error("Failed to load calendars");
            return r.json();
          })
          .then((data: { items?: Array<{ id: string; summary: string; primary?: boolean }> }) => {
            const items = (data.items ?? []).map((c) => ({
              id: c.id,
              summary: c.summary || c.id,
              primary: c.primary,
            }));
            setCalendarList(items);
            if (items.length > 0) {
              const currentInList = items.find((i) => i.id === selectedCalendarId);
              if (!currentInList) {
                const primary = items.find((i) => i.primary) ?? items[0];
                setSelectedCalendarId(primary.id);
                setSelectedCalendarSummary(primary.summary);
                saveGoogleCalendarSelection(primary.id, primary.summary);
              }
            }
          })
          .catch((err) => setCalendarListError(err?.message ?? "Could not load calendars"))
          .finally(() => setCalendarListLoading(false));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isOpen, selectedCalendarId]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-settings-title"
      className="bd-modal-backdrop bd-settings-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bd-modal-panel bd-settings-modal-panel"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--card-radius)",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bd-settings-modal-header"
          style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <h2 id="bd-settings-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {t("settings.title")}
          </h2>
          <button type="button" onClick={onClose} className="bd-btn" style={{ padding: "0.25rem" }} aria-label="Close">
            ×
          </button>
        </div>
        <div className="bd-settings-modal-scroll">
        <div style={{ padding: "1.5rem" }}>
          <label htmlFor="bd-settings-locale" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            {t("lang.label")}
          </label>
          <select
            id="bd-settings-locale"
            className="bd-input"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label={t("lang.label")}
            style={{ marginBottom: "1rem", width: "100%", cursor: "pointer" }}
          >
            <option value="en">{t("lang.english")}</option>
            <option value="sv">{t("lang.swedish")}</option>
          </select>
          <label htmlFor="bd-text-size" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Text size
          </label>
          <select
            id="bd-text-size"
            className="bd-input"
            value={textSize}
            onChange={(e) => setTextSize(e.target.value)}
            style={{ marginBottom: "1rem", width: "100%" }}
          >
            {TEXT_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "1rem" }}>
            <span>{t("settings.showEntryTitles")}</span>
            <label className="bd-ios-switch">
              <input
                type="checkbox"
                checked={showEntryTitles}
                onChange={(e) => {
                  const v = e.target.checked;
                  setShowEntryTitles(v);
                  saveShowEntryTitles(v);
                }}
              />
              <span className="bd-ios-switch-track">
                <span className="bd-ios-switch-knob" />
              </span>
            </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "1rem" }}>
            <span>{t("settings.showDumpFace")}</span>
            <label className="bd-ios-switch">
              <input
                type="checkbox"
                checked={showDumpFace}
                onChange={(e) => {
                  const v = e.target.checked;
                  setShowDumpFace(v);
                  saveShowDumpFace(v);
                }}
              />
              <span className="bd-ios-switch-track">
                <span className="bd-ios-switch-knob" />
              </span>
            </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
            <span>{t("settings.soundEffects")}</span>
            <label className="bd-ios-switch">
              <input
                type="checkbox"
                checked={soundEffects}
                onChange={(e) => setSoundEffects(e.target.checked)}
              />
              <span className="bd-ios-switch-track">
                <span className="bd-ios-switch-knob" />
              </span>
            </label>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0 0 1rem", lineHeight: 1.45, paddingLeft: "1.625rem" }}>
            {t("settings.soundEffectsHelp")}
          </p>
          <div style={{ marginBottom: "1rem" }}>
            {/* Header row: label + connect button */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35 }}>
                  {t("settings.googleCalendarSync")}
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0.2rem 0 0", lineHeight: 1.45 }}>
                  {t("settings.googleCalendarHelp")}
                </p>
              </div>
              <button
                type="button"
                className="bd-btn"
                onClick={() => void openGoogleOAuth()}
                disabled={connectBusy || calendarListLoading}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  padding: "0.45rem 0.85rem",
                  whiteSpace: "nowrap",
                }}
              >
                {/* Google "G" logo */}
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" />
                </svg>
                {connectBusy || calendarListLoading
                  ? "Connecting…"
                  : googleCalendarSync
                  ? "Reconnect"
                  : "Connect"}
              </button>
            </div>

            {/* Connected state */}
            {googleCalendarSync && (
              <div style={{ marginTop: "0.75rem" }}>
                {calendarListError && (
                  <p style={{ fontSize: "0.75rem", color: "var(--bd-danger)", margin: "0 0 0.35rem" }}>{calendarListError}</p>
                )}
                {selectedCalendarId && selectedCalendarSummary && calendarList.length === 0 && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "0 0 0.35rem", fontWeight: 500 }}>
                    {selectedCalendarSummary}
                  </p>
                )}
                {calendarList.length > 0 && (
                  <>
                    <label htmlFor="bd-google-calendar" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                      Calendar to sync with
                    </label>
                    <select
                      id="bd-google-calendar"
                      className="bd-input"
                      value={selectedCalendarId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const cal = calendarList.find((c) => c.id === id);
                        setSelectedCalendarId(id || null);
                        const summary = cal?.summary ?? "";
                        setSelectedCalendarSummary(summary);
                        if (id && summary) saveGoogleCalendarSelection(id, summary);
                      }}
                      style={{ width: "100%", marginBottom: "0.5rem" }}
                    >
                      {calendarList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary}{c.primary ? " (primary)" : ""}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {(selectedCalendarId || calendarList.length > 0) && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="bd-btn bd-btn-primary"
                      disabled={calendarImportBusy}
                      onClick={() => void runGoogleImportIntoBrainDump()}
                    >
                      {calendarImportBusy ? t("settings.googleCalendarImporting") : t("settings.googleCalendarImportButton")}
                    </button>
                    <button
                      type="button"
                      className="bd-btn"
                      onClick={() => {
                        clearGoogleCalendarAccessToken();
                        setGoogleCalendarSync(false);
                        saveGoogleCalendarSync(false);
                        setCalendarList([]);
                        setSelectedCalendarId(null);
                        setSelectedCalendarSummary("");
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )}
            {calendarListError && !googleCalendarSync && (
              <p style={{ fontSize: "0.75rem", color: "var(--bd-danger)", margin: "0.35rem 0 0" }}>{calendarListError}</p>
            )}
          </div>
          <div
            style={{
              marginBottom: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <h3
              style={{
                margin: "0 0 0.35rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {t("settings.appleCalendarTitle")}
            </h3>
            <input
              ref={icsFileInputRef}
              type="file"
              accept=".ics,text/calendar,.ical"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runIcsImportIntoBrainDump(f);
                e.target.value = "";
              }}
            />
            {isIosNativeCalendarImportAvailable() ? (
              <>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
                  {t("settings.appleCalendarIntroIosNative")}
                </p>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  disabled={calendarImportBusy}
                  onClick={() => void runAppleNativeImport()}
                  style={{ marginBottom: "0.5rem" }}
                >
                  {calendarImportBusy ? t("settings.googleCalendarImporting") : t("settings.appleCalendarImportFromDevice")}
                </button>
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setAppleIcsAdvancedOpen((o) => !o)}
                  aria-expanded={appleIcsAdvancedOpen}
                  style={{ marginBottom: appleIcsAdvancedOpen ? "0.5rem" : 0 }}
                >
                  {appleIcsAdvancedOpen ? t("settings.appleCalendarAdvancedIcsHide") : t("settings.appleCalendarAdvancedIcs")}
                </button>
                {appleIcsAdvancedOpen && (
                  <div style={{ marginTop: "0.35rem" }}>
                    <button
                      type="button"
                      className="bd-btn bd-btn-primary"
                      disabled={calendarImportBusy}
                      onClick={() => icsFileInputRef.current?.click()}
                      style={{ marginBottom: "0.5rem" }}
                    >
                      {calendarImportBusy ? t("settings.googleCalendarImporting") : t("settings.appleCalendarImportIcsButton")}
                    </button>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
                      {t("settings.appleCalendarIcsHelp")}
                    </p>
                    <button
                      type="button"
                      className="bd-btn"
                      onClick={() => setAppleCalendarStepsOpen((o) => !o)}
                      aria-expanded={appleCalendarStepsOpen}
                      style={{ marginBottom: appleCalendarStepsOpen ? "0.5rem" : 0 }}
                    >
                      {appleCalendarStepsOpen ? t("settings.appleCalendarToggleStepsHide") : t("settings.appleCalendarToggleSteps")}
                    </button>
                    {appleCalendarStepsOpen && (
                      <div style={{ marginTop: "0.35rem" }}>
                        <ul
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-secondary)",
                            paddingLeft: "1.25rem",
                            margin: "0 0 0.75rem",
                            lineHeight: 1.55,
                          }}
                        >
                          <li style={{ marginBottom: "0.35rem" }}>{t("settings.appleCalendarExportStepMac")}</li>
                          <li style={{ marginBottom: "0.35rem" }}>{t("settings.appleCalendarExportStepIos")}</li>
                        </ul>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
                          {t("settings.appleCalendarIcloudNote")}
                        </p>
                        <a
                          href="https://support.apple.com/guide/iphone/iphc876bfcf3/ios"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bd-btn"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "0.8125rem",
                            textDecoration: "none",
                          }}
                        >
                          {t("settings.appleCalendarSupportLink")}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
                  {t("settings.appleCalendarIntro")}
                </p>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  disabled={calendarImportBusy}
                  onClick={() => icsFileInputRef.current?.click()}
                  style={{ marginBottom: "0.5rem" }}
                >
                  {calendarImportBusy ? t("settings.googleCalendarImporting") : t("settings.appleCalendarImportIcsButton")}
                </button>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
                  {t("settings.appleCalendarIcsHelp")}
                </p>
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setAppleCalendarStepsOpen((o) => !o)}
                  aria-expanded={appleCalendarStepsOpen}
                  style={{ marginBottom: appleCalendarStepsOpen ? "0.5rem" : 0 }}
                >
                  {appleCalendarStepsOpen ? t("settings.appleCalendarToggleStepsHide") : t("settings.appleCalendarToggleSteps")}
                </button>
                {appleCalendarStepsOpen && (
                  <div style={{ marginTop: "0.35rem" }}>
                    <ul
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-secondary)",
                        paddingLeft: "1.25rem",
                        margin: "0 0 0.75rem",
                        lineHeight: 1.55,
                      }}
                    >
                      <li style={{ marginBottom: "0.35rem" }}>{t("settings.appleCalendarExportStepMac")}</li>
                      <li style={{ marginBottom: "0.35rem" }}>{t("settings.appleCalendarExportStepIos")}</li>
                    </ul>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
                      {t("settings.appleCalendarIcloudNote")}
                    </p>
                    <a
                      href="https://support.apple.com/guide/iphone/iphc876bfcf3/ios"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bd-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: "0.8125rem",
                        textDecoration: "none",
                      }}
                    >
                      {t("settings.appleCalendarSupportLink")}
                    </a>
                  </div>
                )}
              </>
            )}
            <p style={{ fontSize: "0.72rem", color: "var(--text-quaternary)", margin: "0.75rem 0 0", lineHeight: 1.45 }}>
              {t("settings.calendarImportTargetNote")}
            </p>
            {calendarImportMessage && (
              <p
                style={{
                  fontSize: "0.8125rem",
                  margin: "0.45rem 0 0",
                  color: calendarImportMessage.tone === "ok" ? "var(--text-secondary)" : "var(--accent)",
                }}
              >
                {calendarImportMessage.text}
              </p>
            )}
          </div>
          <div
            style={{
              marginBottom: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => window.open(`${window.location.origin}/privacy`, "_blank", "noopener,noreferrer")}
            >
              {t("settings.privacy")}
            </button>
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0.45rem 0 0", lineHeight: 1.45 }}>
              {t("settings.privacyHelp")}
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
