"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { COACH_MODE_IDS, type CoachModeId } from "@/lib/coach-modes";

type ChatMsg = { role: "user" | "assistant"; content: string };

/** Renders markdown-style **bold** as <strong>; leaves unmatched ** as plain text. */
function coachChatFormattedContent(text: string): ReactNode {
  const re = /\*\*([\s\S]*?)\*\*/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<strong key={`bd-coach-b-${k++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 0 ? text : <Fragment>{nodes}</Fragment>;
}

type CoachChatOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function CoachChatOverlay({ open, onClose }: CoachChatOverlayProps) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [coachMode, setCoachMode] = useState<CoachModeId>("balanced");
  const listRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const abortRecording = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    setRecording(false);
  }, [stopStream]);

  useEffect(() => {
    if (!open) {
      abortRecording();
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      abortRecording();
    };
  }, [open, abortRecording]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages, loading]);

  const startRecording = async () => {
    setError(null);
    if (loading || recording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("coach.voiceUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        void (async () => {
          if (blob.size < 80) return;
          try {
            const form = new FormData();
            form.append("file", blob, "coach.webm");
            form.append("language", locale === "sv" ? "sv" : "en");
            const r = await fetch("/api/transcribe", { method: "POST", body: form });
            const data = (await r.json()) as { transcript?: string; error?: string };
            if (!r.ok) {
              setError(data.error ?? t("coach.transcribeFailed"));
              return;
            }
            const text = (data.transcript ?? "").trim();
            if (text) {
              setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
            }
          } catch {
            setError(t("coach.transcribeFailed"));
          }
        })();
      };
      rec.start(250);
      setRecording(true);
    } catch {
      setError(t("coach.micDenied"));
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    setRecording(false);
  };

  const startNewChat = useCallback(() => {
    if (loading) return;
    abortRecording();
    setMessages([]);
    setInput("");
    setError(null);
  }, [loading, abortRecording]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const r = await fetch("/api/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, locale, coachMode }),
      });
      const data = (await r.json()) as { message?: string; error?: string };
      if (!r.ok) {
        throw new Error(data.error || t("coach.sendFailed"));
      }
      const reply = (data.message ?? "").trim();
      if (!reply) throw new Error(t("coach.emptyReply"));
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("coach.sendFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="bd-coach-overlay" role="dialog" aria-modal="true" aria-labelledby="bd-coach-title">
      <button type="button" className="bd-coach-backdrop" aria-label={t("coach.close")} onClick={onClose} />
      <div className="bd-coach-panel bd-panel">
        <header className="bd-coach-head">
          <div>
            <h2 id="bd-coach-title" className="bd-coach-title">
              {t("coach.title")}
            </h2>
            <p className="bd-coach-sub">{t("coach.subtitle")}</p>
          </div>
          <button type="button" className="bd-btn bd-coach-close" onClick={onClose} aria-label={t("coach.close")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="bd-coach-chat-toolbar">
          <button
            type="button"
            className="bd-btn bd-coach-new-chat"
            onClick={startNewChat}
            disabled={loading}
            aria-label={t("coach.newChat")}
            title={t("coach.newChat")}
          >
            {t("coach.newChat")}
          </button>
          <label className="bd-coach-style-field">
            <span className="bd-coach-style-label">{t("coach.styleLabel")}</span>
            <select
              id="bd-coach-style"
              className="bd-input bd-coach-style-select"
              value={coachMode}
              onChange={(e) => setCoachMode(e.target.value as CoachModeId)}
              disabled={loading}
              aria-label={t("coach.styleLabel")}
            >
              {COACH_MODE_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`coach.style.${id}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div ref={listRef} className="bd-coach-messages">
          {messages.length === 0 ? (
            <p className="bd-coach-hint">{t("coach.emptyHint")}</p>
          ) : (
            messages.map((m, i) => (
              <div
                key={`${m.role}-${i}-${m.content.slice(0, 24)}`}
                className={`bd-coach-bubble bd-coach-bubble--${m.role}`}
              >
                {coachChatFormattedContent(m.content)}
              </div>
            ))
          )}
          {loading ? (
            <div className="bd-coach-bubble bd-coach-bubble--assistant bd-coach-typing" aria-live="polite">
              {t("coach.thinking")}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="bd-coach-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="bd-coach-compose">
          <button
            type="button"
            className={`bd-coach-voice${recording ? " bd-coach-voice--active" : ""}`}
            onClick={() => (recording ? stopRecording() : void startRecording())}
            disabled={loading}
            title={recording ? t("coach.stopRecording") : t("coach.startRecording")}
            aria-label={recording ? t("coach.stopRecording") : t("coach.startRecording")}
            aria-pressed={recording}
          >
            {recording ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>
          <textarea
            className="bd-input bd-coach-input"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("coach.placeholder")}
            disabled={loading || recording}
            aria-label={t("coach.inputAria")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <button
            type="button"
            className="bd-btn bd-btn-primary bd-coach-send"
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim() || recording}
            aria-label={t("coach.send")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" opacity="0.9" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
