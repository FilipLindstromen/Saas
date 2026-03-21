"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { loadFormState, saveFormState } from "@/lib/form-storage";
import { UnclearOverlay } from "./UnclearOverlay";
import { ItemsViewArea, type ItemsViewType } from "./ItemsViewArea";

const MIC_STORAGE_KEY = "braindump-selected-microphone";
const UNCLEAR_CONFIDENCE_THRESHOLD = 0.65;

type RecordState = "idle" | "recording";

interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface OrganizedItemPreview {
  domain: string;
  category: string;
  subcategory?: string;
  project_name?: string;
  item_type: string;
  title: string;
  content?: string;
  emotion_label?: string;
  recommended_view?: string;
  confidence_score?: number;
  tags?: string[];
}

function getStoredOpenAIKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("saasApiKeys");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return (parsed.openai ?? "").trim();
  } catch {
    return "";
  }
}

const OPENAI_KEY_ERROR = "OpenAI API key is not configured";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface CenterPanelProps {
  mode: string;
  onTranscriptReady: (text: string) => void;
  onOrganized: (items: OrganizedItemPreview[], transcript: string) => void;
  onAutoSave?: (items: OrganizedItemPreview[], transcript: string) => void;
  transcriptFromOrganize?: string;
  onOpenSettings?: () => void;
  projectNames?: string[];
  projectId?: string | null;
  category?: string | null;
  itemType?: string | null;
  onItemTypeSelect?: (type: string | null) => void;
  viewType?: ItemsViewType;
  onViewTypeChange?: (v: ItemsViewType) => void;
  searchFilter?: string;
}

function getDefaultDomainFromMode(mode: string): "work" | "personal" | undefined {
  if (mode === "work") return "work";
  if (mode === "personal") return "personal";
  return undefined;
}

export function CenterPanel({
  mode,
  onTranscriptReady,
  onOrganized,
  onAutoSave,
  transcriptFromOrganize,
  onOpenSettings,
  projectNames = [],
  projectId = null,
  category = null,
  itemType = null,
  onItemTypeSelect,
  viewType,
  onViewTypeChange,
  searchFilter = "",
}: CenterPanelProps) {
  const { t, locale } = useI18n();
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [transcript, setTranscript] = useState("");
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [organizeLoading, setOrganizeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState("0:00");
  const [organizeSuccess, setOrganizeSuccess] = useState<string | null>(null);
  const [unclearItems, setUnclearItems] = useState<{ items: OrganizedItemPreview[]; allItems: OrganizedItemPreview[]; transcript: string } | null>(null);
  const [showDumpOverlay, setShowDumpOverlay] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [audioReadyTick, setAudioReadyTick] = useState(0);
  const [itemsReloadKey, setItemsReloadKey] = useState(0);
  const notifyAudioReadyRef = useRef(() => setAudioReadyTick((t) => t + 1));
  notifyAudioReadyRef.current = () => setAudioReadyTick((t) => t + 1);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordingMimeTypeRef = useRef<string>("audio/webm");
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode } | null>(null);
  const animationRef = useRef<number>(0);

  const loadDevices = useCallback(async (withPermission = false) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      if (withPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`, groupId: d.groupId }));
      setAudioDevices(inputs);
      setSelectedDeviceId((prev) => {
        if (inputs.length === 0) return "";
        const saved = typeof localStorage !== "undefined" ? localStorage.getItem(MIC_STORAGE_KEY) : null;
        if (saved && inputs.some((i) => i.deviceId === saved)) return saved;
        return prev && inputs.some((i) => i.deviceId === prev) ? prev : inputs[0].deviceId;
      });
    } catch {
      setAudioDevices([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 768px)").matches) return;
    loadDevices();
  }, [loadDevices, isMobile]);

  useEffect(() => {
    if (!showDumpOverlay || typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 768px)").matches) return;
    loadDevices(true);
  }, [showDumpOverlay, loadDevices]);

  useEffect(() => {
    if (recordState !== "recording") return;
    setRecordingElapsed("0:00");
    recordingStartRef.current = Date.now();
    const interval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordingStartRef.current) / 1000);
      setRecordingElapsed(formatElapsed(sec));
    }, 1000);
    return () => clearInterval(interval);
  }, [recordState]);

  useEffect(() => {
    if (recordState !== "recording" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let analyser: AnalyserNode;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    const ref = analyserRef.current;
    if (ref?.analyser) {
      analyser = ref.analyser;
    } else if (streamRef.current) {
      const AudioContextClass = typeof window !== "undefined" && (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (!AudioContextClass) return;
      audioContext = new AudioContextClass();
      source = audioContext.createMediaStreamSource(streamRef.current);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
    } else {
      return;
    }
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const W = canvas.width;
    const H = canvas.height;
    const cancelled = { current: false };
    const runVisualizer = () => {
      if (cancelled.current || !canvasRef.current) return;
      animationRef.current = requestAnimationFrame(runVisualizer);
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = "var(--bg-primary)";
      ctx.fillRect(0, 0, W, H);
      const barCount = Math.min(32, Math.floor(W / 6));
      const step = Math.floor(dataArray.length / barCount);
      const barWidth = Math.max(2, W / barCount - 2);
      for (let i = 0; i < barCount; i++) {
        const v = dataArray[i * step] ?? 0;
        const h = Math.max(2, (v / 255) * H * 0.9);
        ctx.fillStyle = "var(--accent)";
        ctx.fillRect(i * (W / barCount) + 1, H - h, barWidth, h);
      }
    };
    if (audioContext?.state === "suspended") {
      audioContext.resume().then(() => { if (!cancelled.current) runVisualizer(); }).catch(() => {});
    } else {
      runVisualizer();
    }
    return () => {
      cancelled.current = true;
      cancelAnimationFrame(animationRef.current);
      if (source) source.disconnect();
      if (audioContext) audioContext.close().catch(() => {});
    };
  }, [recordState]);

  const saved = loadFormState();
  useEffect(() => {
    setTranscript(saved.transcriptEdited || saved.transcriptRaw || "");
  }, []);
  useEffect(() => {
    if (transcriptFromOrganize != null) setTranscript(transcriptFromOrganize);
  }, [transcriptFromOrganize]);

  const saveTranscriptToStorage = useCallback((value: string) => {
    setTranscript(value);
    saveFormState({ transcriptEdited: value, transcriptRaw: value });
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      let stream: MediaStream | null = null;
      if (isMobile) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else if (selectedDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedDeviceId } },
          });
        } catch {
          stream = null;
        }
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { ideal: selectedDeviceId } },
            });
          } catch {
            stream = null;
          }
        }
      }
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!isMobile && selectedDeviceId) {
        try {
          localStorage.setItem(MIC_STORAGE_KEY, selectedDeviceId);
        } catch {}
      }
      streamRef.current = stream;
      chunksRef.current = [];
      recordingStartRef.current = Date.now();

      const AudioContextClass = typeof window !== "undefined" && (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      let streamToRecord: MediaStream = stream;
      if (AudioContextClass && stream.getAudioTracks().length > 0) {
        try {
          const audioContext = new AudioContextClass();
          if (audioContext.state === "suspended") await audioContext.resume();
          const source = audioContext.createMediaStreamSource(stream);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          const destTracks = destination.stream.getAudioTracks();
          if (destTracks.length > 0) {
            streamToRecord = new MediaStream(destTracks);
            analyserRef.current = { ctx: audioContext, analyser: (() => {
              const a = audioContext.createAnalyser();
              a.fftSize = 256;
              a.smoothingTimeConstant = 0.8;
              source.connect(a);
              return a;
            })(), source };
          }
        } catch {
          analyserRef.current = null;
        }
      }

      const recorder = new MediaRecorder(streamToRecord);
      recordingMimeTypeRef.current = recorder.mimeType || "audio/webm";
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (streamToRecord !== stream) streamToRecord.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (analyserRef.current?.ctx) {
          analyserRef.current.ctx.close().catch(() => {});
          analyserRef.current = null;
        }
        const mime = recordingMimeTypeRef.current || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const win = window as unknown as { __lastAudioBlob?: Blob; __lastAudioFileName?: string };
        if (blob.size > 0) {
          win.__lastAudioBlob = blob;
          win.__lastAudioFileName = mime.includes("mp4") || mime.includes("m4a") ? "recording.mp4" : "recording.webm";
          notifyAudioReadyRef.current();
        } else {
          win.__lastAudioBlob = undefined;
          win.__lastAudioFileName = undefined;
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordState("recording");
    } catch (e) {
      setError(t("error.micDenied"));
    }
  }, [selectedDeviceId, isMobile, t]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      setRecordState("idle");
      mediaRecorderRef.current = null;
      setTimeout(() => {
        const win = window as unknown as { __lastAudioBlob?: Blob };
        const blob = win.__lastAudioBlob;
        if (!blob || blob.size === 0) {
          setError(t("error.noAudio"));
        }
      }, 200);
    }
  }, [t]);

  const transcribe = useCallback(async (): Promise<string | null> => {
    const win = window as unknown as { __lastAudioBlob?: Blob; __lastAudioFileName?: string };
    const blob = win.__lastAudioBlob;
    const fileName = win.__lastAudioFileName || "recording.webm";
    if (!blob) {
      setError(t("error.recordFirst"));
      return null;
    }
    if (blob.size === 0) {
      setError(t("error.emptyRecording"));
      return null;
    }
    setError(null);
    setTranscribeLoading(true);
    try {
      const form = new FormData();
      form.append("file", blob, fileName);
      const key = getStoredOpenAIKey();
      if (key) form.append("apiKey", key);
      if (locale === "sv") form.append("language", "sv");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Transcription failed";
        if (typeof msg === "string" && (msg.includes(OPENAI_KEY_ERROR) || msg.includes("OPENAI_API_KEY"))) {
          onOpenSettings?.();
        }
        throw new Error(msg);
      }
      const text = (data.transcript || "").trim();
      setTranscript((prev) => (prev ? prev + "\n\n" + text : text));
      saveFormState({ transcriptRaw: text, transcriptEdited: (transcript || "") + (transcript ? "\n\n" + text : text) });
      onTranscriptReady(text);
      return text;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
      return null;
    } finally {
      setTranscribeLoading(false);
    }
  }, [transcript, onTranscriptReady, onOpenSettings, locale, t]);

  const applyOrganizeResult = useCallback(
    (items: OrganizedItemPreview[], text: string) => {
      const n = items.length;
      if (onAutoSave) {
        onAutoSave(items, text);
        setOrganizeSuccess(n ? t("center.organizedSaved", { n }) : null);
      } else {
        onOrganized(items, text);
        setOrganizeSuccess(n ? t("center.organizedReview", { n }) : null);
      }
      if (n) setTimeout(() => setOrganizeSuccess(null), 5000);
    },
    [onAutoSave, onOrganized, t]
  );

  const organize = useCallback(async (transcriptOverride?: string) => {
    const text = (transcriptOverride ?? transcript).trim();
    if (!text) {
      setError(t("error.enterTranscript"));
      return;
    }
    setError(null);
    setOrganizeLoading(true);
    setUnclearItems(null);
    try {
      const key = getStoredOpenAIKey();
      const defaultDomain = getDefaultDomainFromMode(mode);
      let customCategories: string[] | undefined;
      try {
        const raw = localStorage.getItem("braindump_custom_areas");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) customCategories = parsed.filter((c: unknown) => typeof c === "string" && c.trim());
        }
      } catch {}
      const res = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          locale,
          ...(key ? { apiKey: key } : {}),
          projectNames: projectNames.length > 0 ? projectNames : undefined,
          ...(defaultDomain ? { defaultDomain } : {}),
          ...(customCategories?.length ? { customCategories } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Organization failed";
        if (typeof msg === "string" && (msg.includes(OPENAI_KEY_ERROR) || msg.includes("OPENAI_API_KEY"))) {
          onOpenSettings?.();
        }
        throw new Error(msg);
      }
      const items: OrganizedItemPreview[] = Array.isArray(data.items) ? data.items : [];
      const unclear = items.filter((it) => (it.confidence_score ?? 0.8) < UNCLEAR_CONFIDENCE_THRESHOLD);
      if (unclear.length > 0) {
        setUnclearItems({ items: unclear, allItems: items, transcript: text });
      } else {
        applyOrganizeResult(items, text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Organization failed");
    } finally {
      setOrganizeLoading(false);
    }
  }, [transcript, projectNames, onOpenSettings, onAutoSave, applyOrganizeResult, mode, locale, t]);

  const handleStopAndProcess = useCallback(async () => {
    stopRecording();
    await new Promise((r) => setTimeout(r, 350));
    const text = await transcribe();
    if (text) await organize(text);
  }, [stopRecording, transcribe, organize]);

  const handleCancelRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleUnclearConfirm = useCallback(
    (resolvedUnclear: OrganizedItemPreview[]) => {
      if (!unclearItems) return;
      const { allItems, transcript: text } = unclearItems;
      const merged = allItems.map((it) => {
        const idx = unclearItems.items.findIndex((u) => u.title === it.title && (u.content ?? "") === (it.content ?? ""));
        if (idx >= 0 && resolvedUnclear[idx]) return resolvedUnclear[idx];
        return it;
      });
      setUnclearItems(null);
      applyOrganizeResult(merged, text);
    },
    [unclearItems, applyOrganizeResult]
  );

  const hasAudio = typeof window !== "undefined" && !!(window as unknown as { __lastAudioBlob?: Blob }).__lastAudioBlob;
  const canTranscribe = hasAudio && !transcribeLoading;
  const playbackUrlRef = useRef<string | null>(null);
  const playLatestRecording = useCallback(() => {
    const win = window as unknown as { __lastAudioBlob?: Blob };
    const blob = win.__lastAudioBlob;
    if (!blob) return;
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    const url = URL.createObjectURL(blob);
    playbackUrlRef.current = url;
    const audio = new Audio(url);
    audio.onended = () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }
    };
    audio.onerror = () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }
    };
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }
    };
  }, []);

  const isInbox = mode === "inbox";
  const reflectionQuestions = Array.from({ length: 10 }, (_, i) => t(`help.q${i + 1}`));

  const dumpPanelContent = (
    <>
      <section>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
          {t("center.record")}
        </h3>
        {!isMobile && audioDevices.length > 0 && (
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="bd-mic-select" style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>
              {t("center.microphone")}
            </label>
            <select
              id="bd-mic-select"
              className="bd-input"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={recordState === "recording"}
              style={{ width: "100%", maxWidth: "100%", minHeight: "44px" }}
              aria-label={t("center.microphone")}
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!isMobile && audioDevices.length === 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginBottom: "0.5rem" }}>
            {t("center.allowMic")}
          </p>
        )}
        {recordState === "recording" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("center.inputLevel")}</div>
            <canvas
              ref={canvasRef}
              width={280}
              height={48}
              style={{ width: "100%", maxWidth: "280px", height: "48px", borderRadius: "var(--button-radius)", background: "var(--bg-primary)", border: "1px solid var(--border-default)" }}
              aria-label="Audio input level"
            />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {recordState === "idle" ? (
            <button type="button" className="bd-btn bd-btn-primary" onClick={startRecording} style={{ minHeight: "44px", minWidth: "44px" }}>
              {t("center.dump")}
            </button>
          ) : (
            <>
              <span style={{ fontSize: "1.25rem", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", fontWeight: 500 }} aria-live="polite">
                {recordingElapsed}
              </span>
              <button
                type="button"
                className="bd-btn bd-btn-primary"
                onClick={handleStopAndProcess}
                disabled={transcribeLoading || organizeLoading}
                title={t("center.stopOrganize")}
                aria-label={t("center.stopOrganize")}
                style={{ minHeight: "44px", minWidth: "44px", padding: "0.5rem" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <button
                type="button"
                className="bd-btn bd-btn-danger"
                onClick={handleCancelRecording}
                disabled={transcribeLoading || organizeLoading}
                title={t("center.cancelRecording")}
                aria-label={t("center.cancelRecording")}
                style={{ minHeight: "44px", minWidth: "44px", padding: "0.5rem" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
          {!isMobile && (
            <button type="button" className="bd-btn" onClick={() => loadDevices(true)} title={t("center.refreshMics")} style={{ minHeight: "44px" }}>
              {t("center.refreshMics")}
            </button>
          )}
        </div>
      </section>
      <section>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
          {t("center.transcript")}
        </h3>
        <textarea
          className="bd-textarea"
          value={transcript}
          onChange={(e) => saveTranscriptToStorage(e.target.value)}
          placeholder={t("center.transcriptPlaceholder")}
          style={{ minHeight: "160px", minBlockSize: "160px", fontSize: "16px", borderRadius: 18 }}
          aria-label={t("center.transcript")}
        />
      </section>
      {organizeSuccess && (
        <div style={{ padding: "0.5rem 0.75rem", background: "rgba(34,197,94,0.12)", borderRadius: "var(--button-radius)", color: "var(--text-primary)", fontSize: "0.875rem" }}>
          {organizeSuccess}
        </div>
      )}
      {error && (
        <div style={{ padding: "0.5rem", background: "rgba(255,71,87,0.1)", borderRadius: "var(--button-radius)", color: "#ff4757", fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <span>{error}</span>
          {typeof error === "string" && (error.includes(OPENAI_KEY_ERROR) || error.includes("OPENAI_API_KEY")) && onOpenSettings && (
            <button type="button" className="bd-btn bd-btn-primary" onClick={onOpenSettings} style={{ flexShrink: 0 }}>
              {t("center.openSettings")}
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="bd-center-panel">
      {isInbox && !showDumpOverlay && (
        <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)", margin: 0 }}>
          {t("center.dumpPromptInbox")}
        </p>
      )}
      <button
        id="bd-dump-fab"
        className="bd-dump-fab"
        type="button"
        onClick={() => setShowDumpOverlay(true)}
        title={t("center.recordNewDump")}
        aria-label={t("center.recordNewDump")}
        style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 900,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "var(--accent)",
          color: "#fff",
          cursor: "pointer",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
      {showDumpOverlay && (
            <div
              className="bd-dump-overlay"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
                paddingBlock: "max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-bottom))",
                paddingInline: "max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right))",
                overflow: "auto",
                WebkitOverflowScrolling: "touch",
              }}
              onClick={() => {
                setShowDumpOverlay(false);
                if (mode !== "inbox") setItemsReloadKey((k) => k + 1);
              }}
            >
              <div
                className="bd-panel bd-dump-sheet-inner"
                style={{
                  padding: "1.25rem",
                  maxWidth: 520,
                  width: "100%",
                  maxHeight: "min(90vh, 90dvh)",
                  overflow: "auto",
                  WebkitOverflowScrolling: "touch",
                  minHeight: 0,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bd-dump-sheet-handle" aria-hidden />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("center.newDump")}</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDumpOverlay(false);
                        if (mode !== "inbox") setItemsReloadKey((k) => k + 1);
                      }}
                      aria-label={t("center.close")}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--button-radius)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-tertiary)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="bd-btn"
                      onClick={() => setShowHelpOverlay(true)}
                      style={{ minHeight: "36px", paddingInline: "0.75rem" }}
                    >
                      {t("center.help")}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {dumpPanelContent}
                </div>
              </div>
            </div>
      )}
      {showDumpOverlay && showHelpOverlay && (
        <div
          className="bd-help-overlay-mobile"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))",
          }}
          onClick={() => setShowHelpOverlay(false)}
        >
          <div
            className="bd-panel bd-help-sheet-inner"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "min(85vh, 85dvh)",
              overflow: "auto",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>{t("center.reflectionHelp")}</h3>
              <button
                type="button"
                className="bd-btn"
                onClick={() => setShowHelpOverlay(false)}
                aria-label={t("center.closeHelp")}
                style={{ minHeight: "36px", paddingInline: "0.75rem" }}
              >
                {t("center.closeHelp")}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              {t("center.reflectionHelpIntro")}
            </p>
            <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--text-primary)" }}>
              {reflectionQuestions.map((q) => (
                <li key={q} style={{ fontSize: "0.9375rem", lineHeight: 1.5 }}>
                  {q}
                </li>
              ))}
            </ol>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="bd-btn bd-btn-primary" onClick={() => setShowHelpOverlay(false)}>
                {t("center.gotIt")}
              </button>
            </div>
          </div>
        </div>
      )}
      {!isInbox && (
        <ItemsViewArea
          mode={mode}
          projectId={projectId ?? null}
          category={category ?? null}
          itemType={itemType ?? null}
          onItemTypeSelect={onItemTypeSelect}
          viewType={viewType}
          onViewTypeChange={onViewTypeChange}
          searchFilter={searchFilter}
          reloadKey={itemsReloadKey}
        />
      )}
      {isInbox && unclearItems && (
        <UnclearOverlay
          items={unclearItems.items}
          projectNames={projectNames}
          onConfirm={handleUnclearConfirm}
          onCancel={() => {
            applyOrganizeResult(unclearItems.allItems, unclearItems.transcript);
            setUnclearItems(null);
          }}
        />
      )}
    </div>
  );
}
