"use client";

import { useCallback, useEffect, useState } from "react";

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

function loadOpenAIKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("saasApiKeys");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.openai ?? "";
  } catch {
    return "";
  }
}

function saveOpenAIKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("saasApiKeys");
    const current = raw ? JSON.parse(raw) : {};
    const next = { ...current, openai: key };
    localStorage.setItem("saasApiKeys", JSON.stringify(next));
  } catch (e) {
    console.warn("Failed to save API key", e);
  }
}

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
  const [openaiKey, setOpenaiKey] = useState("");
  const [textSize, setTextSize] = useState("medium");
  const [googleCalendarSync, setGoogleCalendarSync] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [selectedCalendarSummary, setSelectedCalendarSummary] = useState("");
  const [showClientIdOverlay, setShowClientIdOverlay] = useState(false);
  const [calendarList, setCalendarList] = useState<CalendarOption[]>([]);
  const [calendarListLoading, setCalendarListLoading] = useState(false);
  const [calendarListError, setCalendarListError] = useState<string | null>(null);

  useEffect(() => {
    applyTextSizeOnLoad();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setOpenaiKey(loadOpenAIKey());
      setTextSize(loadTextSize());
      setGoogleCalendarSync(loadGoogleCalendarSync());
      setGoogleClientId(loadGoogleClientId());
      setSelectedCalendarId(loadGoogleCalendarId());
      setSelectedCalendarSummary(loadGoogleCalendarSummary());
      setCalendarList([]);
      setCalendarListError(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveOpenAIKey(openaiKey.trim());
    saveTextSize(textSize);
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
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
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 id="bd-settings-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Settings
          </h2>
          <button type="button" onClick={onClose} className="bd-btn" style={{ padding: "0.25rem" }} aria-label="Close">
            ×
          </button>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <label htmlFor="bd-openai-key" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            OpenAI API key
          </label>
          <input
            id="bd-openai-key"
            type="password"
            className="bd-input"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            style={{ marginBottom: "0.5rem" }}
            autoComplete="off"
          />
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "1rem" }}>
            Used for transcription (Whisper) and organization (GPT). Stored in your browser only.
          </p>
          <label htmlFor="bd-text-size" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Text size
          </label>
          <select
            id="bd-text-size"
            className="bd-input"
            value={textSize}
            onChange={(e) => setTextSize(e.target.value)}
            style={{ marginBottom: "0.5rem", width: "100%" }}
          >
            {TEXT_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "1rem" }}>
            Scales all text in the app. Stored in your browser only.
          </p>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={googleCalendarSync}
                onChange={(e) => {
                  const on = e.target.checked;
                  setGoogleCalendarSync(on);
                  if (on && !loadGoogleClientId()) setShowClientIdOverlay(true);
                }}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              Sync with Google Calendar
            </label>
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.35rem", marginLeft: "1.75rem" }}>
              Sync calendar entries to your Google Calendar. Uses the shared Google Client ID from SaaS settings.
            </p>
            {googleCalendarSync && (
              <div style={{ marginTop: "0.75rem", marginLeft: "1.75rem" }}>
                {!googleClientId.trim() ? (
                  <div style={{ padding: "0.75rem", background: "var(--bg-tertiary)", borderRadius: 8, marginBottom: "0.5rem" }}>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>
                      Google Client ID is required. Set it below (shared with SaaS settings).
                    </p>
                    <input
                      type="text"
                      className="bd-input"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="xxxxx.apps.googleusercontent.com"
                      style={{ width: "100%", marginBottom: "0.5rem" }}
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.35rem" }}>
                    Client ID set. Connect and pick a calendar to sync to.
                  </p>
                )}
                <button type="button" className="bd-btn" onClick={openGoogleOAuth} disabled={!googleClientId.trim()} style={{ marginBottom: "0.5rem" }}>
                  {calendarListLoading ? "Loading…" : calendarList.length ? "Reconnect & change calendar" : "Connect and choose calendar"}
                </button>
                {calendarListError && (
                  <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "0.25rem" }}>{calendarListError}</p>
                )}
                {selectedCalendarId && selectedCalendarSummary && calendarList.length === 0 && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                    Selected: {selectedCalendarSummary}
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
              </div>
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
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                  BrainDump uses the shared Google Client ID from SaaS settings. Enter it below to enable Google Calendar sync.
                </p>
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
  );
}
