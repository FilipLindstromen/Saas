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
  onAutoSave?: (items: OrganizedItemPreview[], transcript: string) => void | Promise<void>;
  /** After a successful auto-save from the dump flow: e.g. switch to Work + New filter */
  onDumpFinished?: () => void;
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
  onDumpFinished,
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
  /** False while overlay closed — aborts in-flight `startRecording` if user dismisses quickly */
  const showDumpOverlayRef = useRef(false);

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
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -25;
      source.connect(analyser);
    } else {
      return;
    }
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);
    const W = canvas.width;
    const H = canvas.height;
    const cancelled = { current: false };

    const cssColor = (name: string, fallback: string) => {
      if (typeof document === "undefined") return fallback;
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    };

    const runVisualizer = () => {
      if (cancelled.current || !canvasRef.current) return;
      animationRef.current = requestAnimationFrame(runVisualizer);
      const bg = cssColor("--bg-tertiary", "#181f2a");
      const accent = cssColor("--accent", "#e85d2d");
      const grid = cssColor("--border-default", "rgba(128,128,128,0.25)");

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* Time-domain waveform (canvas ignores CSS `var()` — must use computed colors) */
      analyser.getByteTimeDomainData(timeData);
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const slice = timeData.length / W;
      for (let x = 0; x < W; x++) {
        const i = Math.min(timeData.length - 1, Math.floor(x * slice));
        const v = timeData[i] ?? 128;
        const norm = (v - 128) / 128;
        const y = H / 2 - norm * (H / 2) * 0.92;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      /* Frequency bars (boost quiet speech) */
      analyser.getByteFrequencyData(freqData);
      const barCount = Math.min(40, Math.floor(W / 5));
      const step = Math.max(1, Math.floor(freqData.length / barCount));
      const barWidth = Math.max(1.5, W / barCount - 2);
      for (let i = 0; i < barCount; i++) {
        const v = freqData[i * step] ?? 0;
        const boosted = Math.min(255, v * 1.35 + 8);
        const h = Math.max(1, (boosted / 255) * (H / 2) * 0.85);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(i * (W / barCount) + 1, H - h, barWidth, h);
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
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
      if (!showDumpOverlayRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
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
      if (!showDumpOverlayRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        if (streamToRecord !== stream) streamToRecord.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (analyserRef.current?.ctx) {
          analyserRef.current.ctx.close().catch(() => {});
        }
        analyserRef.current = null;
        return;
      }
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordState("recording");
    } catch (e) {
      setError(t("error.micDenied"));
    }
  }, [selectedDeviceId, isMobile, t]);

  const stopRecording = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      setRecordState("idle");
      mediaRecorderRef.current = null;
      if (!silent) {
        setTimeout(() => {
          const win = window as unknown as { __lastAudioBlob?: Blob };
          const blob = win.__lastAudioBlob;
          if (!blob || blob.size === 0) {
            setError(t("error.noAudio"));
          }
        }, 200);
      }
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
    async (items: OrganizedItemPreview[], text: string) => {
      const n = items.length;
      if (onAutoSave) {
        await Promise.resolve(onAutoSave(items, text));
        setOrganizeSuccess(null);
        showDumpOverlayRef.current = false;
        setShowDumpOverlay(false);
        if (mode !== "inbox") setItemsReloadKey((k) => k + 1);
        onDumpFinished?.();
        return;
      }
      onOrganized(items, text);
      setOrganizeSuccess(n ? t("center.organizedReview", { n }) : null);
      if (n) setTimeout(() => setOrganizeSuccess(null), 5000);
    },
    [onAutoSave, onOrganized, onDumpFinished, mode, t]
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

  const handleUnclearConfirm = useCallback(
    async (resolvedUnclear: OrganizedItemPreview[]) => {
      if (!unclearItems) return;
      const { allItems, transcript: text } = unclearItems;
      const merged = allItems.map((it) => {
        const idx = unclearItems.items.findIndex((u) => u.title === it.title && (u.content ?? "") === (it.content ?? ""));
        if (idx >= 0 && resolvedUnclear[idx]) return resolvedUnclear[idx];
        return it;
      });
      setUnclearItems(null);
      setOrganizeLoading(true);
      try {
        await applyOrganizeResult(merged, text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setOrganizeLoading(false);
      }
    },
    [unclearItems, applyOrganizeResult]
  );

  const isInbox = mode === "inbox";
  const isDumpProcessing = transcribeLoading || organizeLoading;
  const reflectionQuestions = Array.from({ length: 10 }, (_, i) => t(`help.q${i + 1}`));

  useEffect(() => {
    if (isDumpProcessing) setShowHelpOverlay(false);
  }, [isDumpProcessing]);

  const openDumpOverlay = useCallback(() => {
    setError(null);
    showDumpOverlayRef.current = true;
    setShowDumpOverlay(true);
    void startRecording();
  }, [startRecording]);

  const closeDumpOverlay = useCallback(() => {
    if (isDumpProcessing) return;
    showDumpOverlayRef.current = false;
    stopRecording({ silent: true });
    setError(null);
    setShowDumpOverlay(false);
    if (mode !== "inbox") setItemsReloadKey((k) => k + 1);
  }, [isDumpProcessing, stopRecording, mode]);

  const dumpPanelContent = (
    <>
      <section className="bd-dump-overlay-body">
        {!isMobile && audioDevices.length > 0 && (
          <div className="bd-dump-mic-row">
            <label htmlFor="bd-mic-select" style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textAlign: "center" }}>
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
          <p className="bd-dump-mic-hint">{t("center.allowMic")}</p>
        )}
        <div className="bd-dump-controls">
          {recordState === "recording" ? (
            <>
              <div className="bd-dump-canvas-wrap">
                <div className="bd-dump-input-label">{t("center.inputLevel")}</div>
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={64}
                  className="bd-dump-canvas"
                  aria-label="Audio input level"
                />
              </div>
              <div className="bd-dump-actions-row">
                <span className="bd-dump-timer" aria-live="polite">
                  {recordingElapsed}
                </span>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary bd-dump-btn-main"
                  onClick={handleStopAndProcess}
                  disabled={transcribeLoading || organizeLoading}
                  title={t("center.stopOrganize")}
                  aria-label={t("center.stopOrganize")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="bd-btn bd-btn-danger bd-dump-btn-main"
                  onClick={closeDumpOverlay}
                  disabled={transcribeLoading || organizeLoading}
                  title={t("center.cancelRecording")}
                  aria-label={t("center.cancelRecording")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <>
              {!error && (
                <p className="bd-dump-starting-label" aria-live="polite">
                  {t("center.startingMic")}
                </p>
              )}
              <div className="bd-dump-actions-row">
                <button type="button" className="bd-btn bd-btn-danger bd-dump-btn-wide" onClick={closeDumpOverlay} disabled={isDumpProcessing}>
                  {t("center.cancelDump")}
                </button>
              </div>
            </>
          )}
        </div>
        {!isMobile && (
          <div className="bd-dump-refresh-row">
            <button type="button" className="bd-btn" onClick={() => loadDevices(true)} title={t("center.refreshMics")}>
              {t("center.refreshMics")}
            </button>
          </div>
        )}
      </section>
      {organizeSuccess && <div className="bd-banner-success">{organizeSuccess}</div>}
      {error && (
        <div className="bd-banner-error">
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
        onClick={openDumpOverlay}
        title={t("center.recordNewDump")}
        aria-label={t("center.recordNewDump")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
      {showDumpOverlay && !isDumpProcessing && (
            <div
              className="bd-dump-overlay"
              role="presentation"
              onClick={closeDumpOverlay}
            >
              <div
                className="bd-panel bd-dump-sheet-inner"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bd-dump-sheet-handle" aria-hidden />
                <div className="bd-dump-sheet-header">
                  <button
                    type="button"
                    className="bd-dump-sheet-corner-btn"
                    onClick={closeDumpOverlay}
                    disabled={isDumpProcessing}
                    aria-label={t("center.close")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                  <h2 className="bd-dump-sheet-title">{t("center.newDump")}</h2>
                  <button
                    type="button"
                    className="bd-dump-sheet-corner-btn bd-dump-sheet-help-btn"
                    onClick={() => setShowHelpOverlay(true)}
                  >
                    {t("center.help")}
                  </button>
                </div>
                <div className="bd-dump-sheet-content">{dumpPanelContent}</div>
              </div>
            </div>
      )}
      {showDumpOverlay && isDumpProcessing && (
        <div className="bd-dump-processing-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="bd-dump-processing-inner">
            <div className="bd-dump-spinner" aria-hidden />
            <p className="bd-dump-processing-title">{t("center.organizingThoughts")}</p>
          </div>
        </div>
      )}
      {showDumpOverlay && showHelpOverlay && (
        <div
          className="bd-modal-backdrop bd-help-overlay-mobile"
          onClick={() => setShowHelpOverlay(false)}
        >
          <div
            className="bd-panel bd-modal-panel bd-help-sheet-inner"
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
          onCancel={async () => {
            const u = unclearItems;
            if (!u) return;
            setUnclearItems(null);
            setOrganizeLoading(true);
            try {
              await applyOrganizeResult(u.allItems, u.transcript);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Save failed");
            } finally {
              setOrganizeLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}
