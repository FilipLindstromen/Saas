"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { loadShowEntryTitles, saveShowEntryTitles } from "@/lib/entry-display-settings";
import { loadShowDumpFace, saveShowDumpFace } from "@/lib/dump-face-settings";
import { loadSoundEffectsEnabled, saveSoundEffectsEnabled } from "@/lib/sound-effects-settings";
import { loadRevenueCatEnabled, saveRevenueCatEnabled } from "@/lib/revenuecat-settings";
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

const TEXT_SIZE_KEY = "braindump_text_size";
const GOOGLE_CALENDAR_SYNC_KEY = "braindump_google_calendar_sync";
const GOOGLE_CALENDAR_ID_KEY = "braindump_google_calendar_id";
const GOOGLE_CALENDAR_SUMMARY_KEY = "braindump_google_calendar_summary";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

const TEXT_SIZE_OPTIONS = [
  { value: "small", label: "Small", scale: 0.875 },
  { value: "medium", label: "Medium", scale: 1 },
  { value: "large", label: "Large", scale: 1.125 },
  { value: "xlarge", label: "Extra large", scale: 1.25 },
] as const;

function loadTextSize(): string {
  if (typeof window === "undefined") return "medium";
  try {
    const v = localStorage.getItem(TEXT_SIZE_KEY);
    if (v && TEXT_SIZE_OPTIONS.some((o) => o.value === v)) return v;
  } catch {}
  return "medium";
}

function saveTextSize(value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEXT_SIZE_KEY, value);
    const opt = TEXT_SIZE_OPTIONS.find((o) => o.value === value);
    document.documentElement.style.setProperty("--text-scale", String(opt?.scale ?? 1));
  } catch (e) {
    console.warn("Failed to save text size", e);
  }
}

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
  } catch (e) {
    console.warn("Failed to save Google Calendar sync preference", e);
  }
}

function loadGoogleClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("saasApiKeys");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return (parsed.googleClientId ?? "").trim();
  } catch {
    return "";
  }
}

function saveGoogleClientId(clientId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("saasApiKeys");
    const current = raw ? JSON.parse(raw) : {};
    const next = { ...current, googleClientId: clientId.trim() };
    localStorage.setItem("saasApiKeys", JSON.stringify(next));
  } catch (e) {
    console.warn("Failed to save Google Client ID", e);
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
  } catch (e) {
    console.warn("Failed to save calendar selection", e);
  }
}

export function applyTextSizeOnLoad(): void {
  if (typeof window === "undefined") return;
  const value = loadTextSize();
  const opt = TEXT_SIZE_OPTIONS.find((o) => o.value === value);
  document.documentElement.style.setProperty("--text-scale", String(opt?.scale ?? 1));
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
  const [googleClientId, setGoogleClientId] = useState("");
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [selectedCalendarSummary, setSelectedCalendarSummary] = useState("");
  const [showClientIdOverlay, setShowClientIdOverlay] = useState(false);
  const [calendarList, setCalendarList] = useState<CalendarOption[]>([]);
  const [calendarListLoading, setCalendarListLoading] = useState(false);
  const [calendarListError, setCalendarListError] = useState<string | null>(null);
  const [deleteOverlayOpen, setDeleteOverlayOpen] = useState(false);
  const [showEntryTitles, setShowEntryTitles] = useState(true);
  const [showDumpFace, setShowDumpFace] = useState(true);
  const [soundEffects, setSoundEffects] = useState(false);
  const [revenueCatEnabled, setRevenueCatEnabled] = useState(() =>
    typeof window !== "undefined" ? loadRevenueCatEnabled() : true
  );
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
      setRevenueCatEnabled(loadRevenueCatEnabled());
      setGoogleCalendarSync(loadGoogleCalendarSync());
      setGoogleClientId(loadGoogleClientId());
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

  const handleSave = () => {
    saveTextSize(textSize);
    saveShowEntryTitles(showEntryTitles);
    saveShowDumpFace(showDumpFace);
    saveSoundEffectsEnabled(soundEffects);
    saveRevenueCatEnabled(revenueCatEnabled);
    saveGoogleCalendarSync(googleCalendarSync);
    saveGoogleClientId(googleClientId);
    if (selectedCalendarId && selectedCalendarSummary) {
      saveGoogleCalendarSelection(selectedCalendarId, selectedCalendarSummary);
    }
    onClose();
  };

  const openGoogleOAuth = useCallback(() => {
    const clientId = (googleClientId || loadGoogleClientId()).trim();
    if (!clientId) {
      setShowClientIdOverlay(true);
      return;
    }
    const redirectUri = `${typeof window !== "undefined" ? window.location.origin : ""}/google-calendar-callback`;
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
    const w = window.open(url, "braindump-google-oauth", "width=520,height=600,scrollbars=yes");
    if (w) {
      const checkClosed = setInterval(() => {
        if (w.closed) {
          clearInterval(checkClosed);
        }
      }, 300);
    }
  }, [googleClientId]);

  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "braindump-google-calendar-token" && e.data?.accessToken) {
        saveGoogleCalendarAccessToken(
          e.data.accessToken as string,
          typeof e.data.expiresIn === "number" ? e.data.expiresIn : undefined
        );
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
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "1rem" }}>
            <input
              type="checkbox"
              checked={showEntryTitles}
              onChange={(e) => setShowEntryTitles(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }}
            />
            <span>{t("settings.showEntryTitles")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "1rem" }}>
            <input
              type="checkbox"
              checked={showDumpFace}
              onChange={(e) => setShowDumpFace(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }}
            />
            <span>{t("settings.showDumpFace")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
            <input
              type="checkbox"
              checked={soundEffects}
              onChange={(e) => setSoundEffects(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }}
            />
            <span>{t("settings.soundEffects")}</span>
          </label>
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0 0 1rem", lineHeight: 1.45, paddingLeft: "1.625rem" }}>
            {t("settings.soundEffectsHelp")}
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
            <input
              type="checkbox"
              checked={revenueCatEnabled}
              onChange={(e) => setRevenueCatEnabled(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }}
            />
            <span>{t("settings.revenueCat")}</span>
          </label>
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0 0 1rem", lineHeight: 1.45, paddingLeft: "1.625rem" }}>
            {t("settings.revenueCatHelp")}
          </p>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={googleCalendarSync}
                onChange={(e) => {
                  const on = e.target.checked;
                  setGoogleCalendarSync(on);
                  if (!on) clearGoogleCalendarAccessToken();
                  if (on && !loadGoogleClientId()) setShowClientIdOverlay(true);
                }}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              {t("settings.googleCalendarSync")}
            </label>
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "0.25rem 0 0 1.75rem", lineHeight: 1.45 }}>
              {t("settings.googleCalendarHelp")}
            </p>
            {googleCalendarSync && (
              <div style={{ marginTop: "0.75rem", marginLeft: "1.75rem" }}>
                {!googleClientId.trim() ? (
                  <div style={{ padding: "0.75rem", background: "var(--bg-tertiary)", borderRadius: 8, marginBottom: "0.5rem" }}>
                    <label htmlFor="bd-google-client-inline" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                      Google Client ID
                    </label>
                    <input
                      id="bd-google-client-inline"
                      type="text"
                      className="bd-input"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="xxxxx.apps.googleusercontent.com"
                      style={{ width: "100%", marginBottom: "0.5rem" }}
                      autoComplete="off"
                    />
                  </div>
                ) : null}
                <button type="button" className="bd-btn" onClick={openGoogleOAuth} disabled={!googleClientId.trim()} style={{ marginBottom: "0.5rem" }}>
                  {calendarListLoading ? "Loading…" : calendarList.length ? "Reconnect & change calendar" : "Connect and choose calendar"}
                </button>
                {calendarListError && (
                  <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "0.25rem" }}>{calendarListError}</p>
                )}
                {selectedCalendarId && selectedCalendarSummary && calendarList.length === 0 && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.35rem", marginBottom: 0, fontWeight: 500 }}>
                    {selectedCalendarSummary}
                  </p>
                )}
                {calendarList.length > 0 && (
                  <>
                    <label htmlFor="bd-google-calendar" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-secondary)", marginTop: "0.5rem", marginBottom: "0.25rem" }}>
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
                        setSelectedCalendarSummary(cal?.summary ?? "");
                      }}
                      style={{ width: "100%" }}
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
                  <div style={{ marginTop: "0.65rem" }}>
                    <button
                      type="button"
                      className="bd-btn bd-btn-primary"
                      disabled={calendarImportBusy || !googleClientId.trim()}
                      onClick={() => void runGoogleImportIntoBrainDump()}
                    >
                      {calendarImportBusy ? t("settings.googleCalendarImporting") : t("settings.googleCalendarImportButton")}
                    </button>
                  </div>
                )}
              </div>
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
          {showClientIdOverlay && (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1001,
                padding: "1rem",
              }}
              onClick={() => setShowClientIdOverlay(false)}
            >
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--card-radius)",
                  maxWidth: "400px",
                  width: "100%",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-xl)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Google Client ID
                </h3>
                <label htmlFor="bd-google-client-id" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Client ID
                </label>
                <input
                  id="bd-google-client-id"
                  type="text"
                  className="bd-input"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  style={{ width: "100%", marginBottom: "1rem" }}
                  autoComplete="off"
                />
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button type="button" className="bd-btn" onClick={() => setShowClientIdOverlay(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bd-btn bd-btn-primary"
                    onClick={() => {
                      if (googleClientId.trim()) {
                        saveGoogleClientId(googleClientId);
                        setShowClientIdOverlay(false);
                      }
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="bd-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="bd-btn bd-btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
