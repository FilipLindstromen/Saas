"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { loadFormState, saveFormState } from "@/lib/form-storage";
import { fetchWithTimeout, postJsonWithTimeout } from "@/lib/safe-fetch-json";
import { UnclearOverlay } from "./UnclearOverlay";
import { ItemsViewArea, type ItemsViewType } from "./ItemsViewArea";
import { emitSuggestedItemTypesFromOrganize } from "@/lib/item-types";
import { filterNewStandaloneProjectNames } from "@/lib/project-name-match";
import { transcribeAudioBlobs } from "@/lib/transcribe-audio-client";
import { DUMP_FACE_CHANGED, loadShowDumpFace } from "@/lib/dump-face-settings";
import { DumpListeningFace } from "./DumpListeningFace";
import { PhotoCaptureTrigger, type PhotoCaptureTriggerHandle } from "./PhotoCaptureTrigger";
import { useRevenueCatOptional } from "./RevenueCatProvider";

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
  /** Calendar — from organize / AI */
  scheduled_date?: string;
  scheduled_time?: string;
  recurrence?: string;
  send_notification?: boolean;
  reminder_minutes_before?: number;
}

const TRANSCRIBE_TIMEOUT_MS = 120_000;
const ORGANIZE_TIMEOUT_MS = 180_000;
const TRANSCRIBE_IMAGE_TIMEOUT_MS = 120_000;
/** Hard cap on continuous microphone recording (Whisper / UX / cost). */
const MAX_RECORDING_SECONDS = 5 * 60;
/** New MediaRecorder segment every N ms so each /api/transcribe chunk stays small (timeout + Whisper limits). */
const TRANSCRIBE_SEGMENT_MS = 55 * 1000;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DumpEmptyHintCallout({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`bd-dump-empty-hint ${className}`.trim()} aria-live="polite">
      <p className="bd-dump-empty-hint-text">{t("center.dumpEmptyHint")}</p>
      <div className="bd-dump-empty-hint-arrow">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="17" />
          <polyline points="8 13 12 17 16 13" />
        </svg>
      </div>
    </div>
  );
}

interface CenterPanelProps {
  mode: string;
  onTranscriptReady: (text: string) => void;
  onOrganized: (items: OrganizedItemPreview[], transcript: string) => void;
  onAutoSave?: (items: OrganizedItemPreview[], transcript: string) => void | Promise<void>;
  /** After a successful auto-save from the dump flow: e.g. All (work+personal), no project/area, New batch, clear search */
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
  dueDateFilter?: import("@/lib/due-date-filter").DueDateFilterPreset;
  /** Mobile: ScopeBar rendered in one row with items toolbar (from page). */
  scopeSlot?: ReactNode;
  /** Mobile: items view registers controls left of the top-bar menu (see TopBar.beforeMenuSlot). */
  onMobileTopBarBeforeMenuSlot?: (slot: ReactNode | null) => void;
  /** Desktop: items view registers controls left of the scope filter field (see ScopeBar.beforeFilterSlot). */
  onDesktopScopeBeforeFilterSlot?: (slot: ReactNode | null) => void;
  /** After organizing creates new work projects — refetch project list for ScopeBar / prompts. */
  onWorkProjectsChanged?: () => void;
  /** Mic capture active (for global chrome: stop icon, pulse, z-index). */
  onDumpRecordingChange?: (active: boolean) => void;
  onItemMovedToTrash?: (id: string, title: string) => void;
  /** Fires when list/text view is empty and dump hint should show (false when Today view suppresses). */
  onDumpEmptyHintChange?: (show: boolean) => void;
  /** Hide empty-state dump hint (e.g. while Today view is active). */
  dumpHintSuppressed?: boolean;
}

function getDefaultDomainFromMode(mode: string): "work" | "personal" | undefined {
  if (mode === "work") return "work";
  if (mode === "personal") return "personal";
  return undefined;
}

export type BrainDumpCenterHandle = {
  processImageForOrganize: (file: File) => Promise<void>;
  /** Opens the typed-dump sheet (mobile bar or programmatic). */
  openTypedDumpSheet: () => void;
  /** Opens camera / library / webcam menu (sidebar photo action). */
  openPhotoCaptureMenu: () => void;
  /** Same as the main record/stop control (mobile bottom bar calls this; desktop uses #bd-dump-fab). */
  toggleDumpRecording: () => void;
};

export const CenterPanel = forwardRef<BrainDumpCenterHandle, CenterPanelProps>(function CenterPanel(
  {
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
    dueDateFilter = "all",
    scopeSlot = null,
    onMobileTopBarBeforeMenuSlot,
    onDesktopScopeBeforeFilterSlot,
    onWorkProjectsChanged,
    onDumpRecordingChange,
    onItemMovedToTrash,
    onDumpEmptyHintChange,
    dumpHintSuppressed = false,
  },
  ref
) {
  const { t, locale } = useI18n();
  const rc = useRevenueCatOptional();
  /** Always holds the latest RC context so async callbacks read fresh state. */
  const rcRef = useRef(rc);
  rcRef.current = rc;

  /**
   * If RC is supposed to be active (disabledReason === null) but the SDK hasn't
   * finished loading yet, wait up to 4 s before proceeding.
   */
  const waitForRCReady = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (rcRef.current?.disabledReason !== null || rcRef.current?.ready) {
        resolve();
        return;
      }
      const deadline = Date.now() + 4000;
      const poll = () => {
        if (rcRef.current?.ready || rcRef.current?.disabledReason !== null || Date.now() >= deadline) {
          resolve();
        } else {
          setTimeout(poll, 100);
        }
      };
      poll();
    });
  }, []);

  /**
   * Returns true if the paywall should be shown (RC active, loaded, user not subscribed).
   * Must be called after waitForRCReady().
   */
  const shouldShowPaywall = useCallback((): boolean => {
    const r = rcRef.current;
    return Boolean(r?.ready && r?.disabledReason === null && !r?.isPro);
  }, []);

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
  const completedAudioSegmentBlobsRef = useRef<Blob[]>([]);
  /** Browser `setTimeout` id (number); avoids NodeJS.Timeout vs DOM mismatch in `tsc`. */
  const audioRotationTimerRef = useRef<number | null>(null);
  const pendingAudioRotationRef = useRef(false);
  const userEndedRecordingRef = useRef(false);
  const captureStreamsRef = useRef<{ stream: MediaStream; streamToRecord: MediaStream } | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingMimeTypeRef = useRef<string>("audio/webm");
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode } | null>(null);
  const animationRef = useRef<number>(0);
  /** False while overlay closed — aborts in-flight `startRecording` if user dismisses quickly */
  const showDumpOverlayRef = useRef(false);
  const [showDumpFace, setShowDumpFace] = useState(() => (typeof window !== "undefined" ? loadShowDumpFace() : true));
  const [photoOrganizeFlow, setPhotoOrganizeFlow] = useState(false);
  const [showTypedDumpSheet, setShowTypedDumpSheet] = useState(false);
  const [typedDumpText, setTypedDumpText] = useState("");
  const organizeRef = useRef<(override?: string) => Promise<void>>(async () => {});
  const photoAnchorRef = useRef<PhotoCaptureTriggerHandle | null>(null);
  const isDumpProcessing = transcribeLoading || organizeLoading;

  const clearAudioRotationTimer = useCallback(() => {
    if (audioRotationTimerRef.current != null && typeof window !== "undefined") {
      window.clearTimeout(audioRotationTimerRef.current);
      audioRotationTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAudioRotationTimer(), [clearAudioRotationTimer]);

  useEffect(() => {
    const sync = () => setShowDumpFace(loadShowDumpFace());
    window.addEventListener(DUMP_FACE_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DUMP_FACE_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

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

  // Auto-refresh mic list every 3 s on desktop while the dump overlay is open.
  useEffect(() => {
    if (!showDumpOverlay || isMobile) return;
    const id = window.setInterval(() => { void loadDevices(); }, 3000);
    return () => window.clearInterval(id);
  }, [showDumpOverlay, isMobile, loadDevices]);

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
      {
        const w = window as unknown as { __lastAudioBlob?: Blob; __lastAudioFileName?: string; __lastAudioSegments?: Blob[] };
        w.__lastAudioBlob = undefined;
        w.__lastAudioFileName = undefined;
        w.__lastAudioSegments = undefined;
      }

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

      const finalizeAudioCapture = () => {
        clearAudioRotationTimer();
        pendingAudioRotationRef.current = false;
        const cap = captureStreamsRef.current;
        captureStreamsRef.current = null;
        if (cap) {
          cap.stream.getTracks().forEach((t) => t.stop());
          if (cap.streamToRecord !== cap.stream) cap.streamToRecord.getTracks().forEach((t) => t.stop());
        }
        streamRef.current = null;
        if (analyserRef.current?.ctx) {
          analyserRef.current.ctx.close().catch(() => {});
          analyserRef.current = null;
        }
        const mime = recordingMimeTypeRef.current || "audio/webm";
        const win = window as unknown as { __lastAudioBlob?: Blob; __lastAudioFileName?: string; __lastAudioSegments?: Blob[] };
        const segs = completedAudioSegmentBlobsRef.current.filter((b) => b.size > 0);
        if (segs.length > 0) {
          win.__lastAudioSegments = segs;
          win.__lastAudioBlob = segs[segs.length - 1];
          win.__lastAudioFileName = mime.includes("mp4") || mime.includes("m4a") ? "recording.mp4" : "recording.webm";
        } else {
          win.__lastAudioSegments = undefined;
          win.__lastAudioBlob = undefined;
          win.__lastAudioFileName = undefined;
        }
        notifyAudioReadyRef.current();
      };

      const startSegmentRecorder = () => {
        const cap = captureStreamsRef.current;
        if (!cap || !showDumpOverlayRef.current) {
          userEndedRecordingRef.current = true;
          finalizeAudioCapture();
          return;
        }
        const recorder = new MediaRecorder(cap.streamToRecord);
        recordingMimeTypeRef.current = recorder.mimeType || "audio/webm";
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const mime = recordingMimeTypeRef.current || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mime });
          chunksRef.current = [];
          if (blob.size > 0) completedAudioSegmentBlobsRef.current.push(blob);
          clearAudioRotationTimer();

          if (userEndedRecordingRef.current) {
            finalizeAudioCapture();
            return;
          }
          if (pendingAudioRotationRef.current) {
            pendingAudioRotationRef.current = false;
            startSegmentRecorder();
            return;
          }
          finalizeAudioCapture();
        };
        mediaRecorderRef.current = recorder;
        recorder.start(250);
        const tid = window.setTimeout(() => {
          if (userEndedRecordingRef.current) return;
          pendingAudioRotationRef.current = true;
          const r = mediaRecorderRef.current;
          if (r && r.state !== "inactive") r.stop();
        }, TRANSCRIBE_SEGMENT_MS);
        audioRotationTimerRef.current = tid;
      };

      completedAudioSegmentBlobsRef.current = [];
      userEndedRecordingRef.current = false;
      pendingAudioRotationRef.current = false;
      captureStreamsRef.current = { stream, streamToRecord };
      startSegmentRecorder();
      setRecordState("recording");
    } catch (e) {
      setError(t("error.micDenied"));
    }
  }, [selectedDeviceId, isMobile, t, clearAudioRotationTimer]);

  const stopRecording = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    clearAudioRotationTimer();
    pendingAudioRotationRef.current = false;
    userEndedRecordingRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      mediaRecorderRef.current = null;
    }
    setRecordState("idle");
    if (!silent) {
      setTimeout(() => {
        const win = window as unknown as { __lastAudioBlob?: Blob; __lastAudioSegments?: Blob[] };
        const blob = win.__lastAudioBlob;
        const segs = win.__lastAudioSegments;
        const hasAudio = (segs && segs.length > 0 && segs.some((b) => b.size > 0)) || (blob && blob.size > 0);
        if (!hasAudio) {
          setError(t("error.noAudio"));
        }
      }, 320);
    }
  }, [t, clearAudioRotationTimer]);

  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;

  const startRecordingRef = useRef(startRecording);
  startRecordingRef.current = startRecording;

  /**
   * Hot-swap the microphone while recording is active: silently stop the
   * current capture, discard the partial audio, then restart with the newly
   * selected device. Called from the mic <select> onChange.
   */
  const switchMicAndRestart = useCallback(
    (newDeviceId: string) => {
      setSelectedDeviceId(newDeviceId);
      if (recordState !== "recording") return;
      // Discard audio captured so far so the restart is a clean take.
      completedAudioSegmentBlobsRef.current = [];
      chunksRef.current = [];
      const win = window as unknown as {
        __lastAudioBlob?: Blob;
        __lastAudioFileName?: string;
        __lastAudioSegments?: Blob[];
      };
      win.__lastAudioBlob = undefined;
      win.__lastAudioSegments = undefined;
      win.__lastAudioFileName = undefined;
      stopRecording({ silent: true });
      // Wait for the React re-render that picks up the new selectedDeviceId
      // (startRecordingRef.current is updated via its own assignment above).
      setTimeout(() => {
        if (showDumpOverlayRef.current) {
          void startRecordingRef.current();
        }
      }, 200);
    },
    [recordState, stopRecording]
  );

  useEffect(() => {
    if (recordState !== "recording") return;
    setRecordingElapsed("0:00");
    recordingStartRef.current = Date.now();
    const interval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordingStartRef.current) / 1000);
      setRecordingElapsed(formatElapsed(sec));
      if (sec >= MAX_RECORDING_SECONDS) {
        clearInterval(interval);
        stopRecordingRef.current({ silent: true });
        setOrganizeSuccess(t("center.recordingMaxLength"));
        setTimeout(() => setOrganizeSuccess(null), 8000);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [recordState, t]);

  const transcribe = useCallback(async (): Promise<string | null> => {
    const win = window as unknown as { __lastAudioBlob?: Blob; __lastAudioSegments?: Blob[] };
    const segments = win.__lastAudioSegments;
    const blobs =
      segments && segments.length > 0
        ? segments.filter((b) => b.size > 0)
        : win.__lastAudioBlob && win.__lastAudioBlob.size > 0
          ? [win.__lastAudioBlob]
          : [];
    if (blobs.length === 0) {
      setError(t("error.recordFirst"));
      return null;
    }
    setError(null);
    setTranscribeLoading(true);
    try {
      const whisperLang = locale === "sv" ? "sv" : locale === "en" ? "en" : "";
      const text = await transcribeAudioBlobs(blobs, {
        language: whisperLang,
        timeoutMs: TRANSCRIBE_TIMEOUT_MS,
      });
      const trimmed = text.trim();
      if (!trimmed) {
        setError(t("error.emptyRecording"));
        return null;
      }
      setTranscript((prev) => (prev ? prev + "\n\n" + trimmed : trimmed));
      saveFormState({
        transcriptRaw: trimmed,
        transcriptEdited: (transcript || "") + (transcript ? "\n\n" + trimmed : trimmed),
      });
      onTranscriptReady(trimmed);
      return trimmed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transcription failed";
      if (msg === "AUDIO_SEGMENT_TOO_LARGE") {
        setError(t("error.audioTooLarge"));
      } else {
        setError(msg);
      }
      return null;
    } finally {
      setTranscribeLoading(false);
    }
  }, [transcript, onTranscriptReady, locale, t]);

  const applyOrganizeResult = useCallback(
    async (items: OrganizedItemPreview[], text: string) => {
      emitSuggestedItemTypesFromOrganize(items);
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
    saveFormState({ organizeInProgress: true, organizeTranscriptSnapshot: text });
    try {
      const defaultDomain = getDefaultDomainFromMode(mode);
      let customCategories: string[] | undefined;
      try {
        const raw = localStorage.getItem("braindump_custom_areas");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) customCategories = parsed.filter((c: unknown) => typeof c === "string" && c.trim());
        }
      } catch {}
      const now = new Date();
      const referenceLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const body = {
        transcript: text,
        locale,
        referenceIso: now.toISOString(),
        referenceLocalDate,
        projectNames: projectNames.length > 0 ? projectNames : undefined,
        ...(defaultDomain ? { defaultDomain } : {}),
        ...(customCategories?.length ? { customCategories } : {}),
      };
      const { ok, data } = await postJsonWithTimeout<{
        error?: string;
        items?: OrganizedItemPreview[];
        standaloneProjectCreations?: unknown;
      }>("/api/organize", body, ORGANIZE_TIMEOUT_MS);
      if (!ok) {
        const msg = typeof data.error === "string" && data.error ? data.error : "Organization failed";
        throw new Error(msg);
      }
      const standaloneRaw: string[] = Array.isArray(data.standaloneProjectCreations)
        ? data.standaloneProjectCreations.filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0)
        : [];
      const toCreate = filterNewStandaloneProjectNames(standaloneRaw, projectNames);
      let createdStandalone = 0;
      for (const name of toCreate) {
        const resProj = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, domain: "work" }),
        });
        if (resProj.ok) createdStandalone += 1;
      }
      if (createdStandalone > 0) onWorkProjectsChanged?.();

      const items: OrganizedItemPreview[] = Array.isArray(data.items) ? data.items : [];
      const unclear = items.filter((it) => (it.confidence_score ?? 0.8) < UNCLEAR_CONFIDENCE_THRESHOLD);
      saveFormState({ organizeInProgress: false, organizeTranscriptSnapshot: undefined });
      try {
        sessionStorage.removeItem("braindump-resume-attempt");
      } catch {
        /* ignore */
      }
      if (createdStandalone > 0) {
        setOrganizeSuccess(t("center.projectsCreatedOnly", { n: createdStandalone }));
        setTimeout(() => setOrganizeSuccess(null), 5000);
      }
      if (unclear.length > 0) {
        setUnclearItems({ items: unclear, allItems: items, transcript: text });
      } else {
        await applyOrganizeResult(items, text);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Organization failed";
      setError(msg.toLowerCase().includes("timed out") ? t("center.organizeNetworkError") : msg);
    } finally {
      setOrganizeLoading(false);
    }
  }, [transcript, projectNames, onAutoSave, applyOrganizeResult, mode, locale, t, onWorkProjectsChanged]);

  const organizeFromTypedText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) {
        setError(t("error.enterTranscript"));
        return;
      }
      setError(null);
      setTranscript((prev) => {
        const edited = prev ? `${prev}\n\n${text}` : text;
        saveFormState({ transcriptRaw: text, transcriptEdited: edited });
        return edited;
      });
      onTranscriptReady(text);
      await organize(text);
    },
    [organize, onTranscriptReady, t]
  );

  const processImageForOrganize = useCallback(
    async (file: File) => {
      if (!file || file.size === 0) {
        setError(t("error.emptyImage"));
        return;
      }
      setError(null);
      setPhotoOrganizeFlow(true);
      setTranscribeLoading(true);
      try {
        const form = new FormData();
        form.append("image", file);
        form.append("locale", locale);
        const res = await fetchWithTimeout("/api/transcribe-image", { method: "POST", body: form }, TRANSCRIBE_IMAGE_TIMEOUT_MS);
        const raw = await res.text();
        let data: { error?: string; transcript?: string };
        try {
          data = raw.trim() ? JSON.parse(raw) : {};
        } catch {
          throw new Error(!res.ok ? raw.trim().slice(0, 240) || `Image transcription failed (${res.status})` : "Invalid response from server");
        }
        if (!res.ok) {
          const msg = data.error || "Image transcription failed";
          throw new Error(msg);
        }
        const text = (data.transcript || "").trim();
        if (!text) {
          throw new Error(t("error.noTextInImage"));
        }
        setTranscript((prev) => (prev ? prev + "\n\n" + text : text));
        saveFormState({
          transcriptRaw: text,
          transcriptEdited: (transcript || "") + (transcript ? "\n\n" + text : text),
        });
        onTranscriptReady(text);
        setTranscribeLoading(false);
        await organize(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Photo processing failed");
      } finally {
        setTranscribeLoading(false);
        setPhotoOrganizeFlow(false);
      }
    },
    [locale, onTranscriptReady, organize, transcript, t]
  );

  const leaveVoiceDumpSessionForOtherInput = useCallback(() => {
    if (isDumpProcessing) return;
    if (!showDumpOverlay && recordState !== "recording") return;
    showDumpOverlayRef.current = false;
    stopRecording({ silent: true });
    setError(null);
    setShowDumpOverlay(false);
    if (mode !== "inbox") setItemsReloadKey((k) => k + 1);
  }, [isDumpProcessing, showDumpOverlay, recordState, stopRecording, mode]);

  const openTypedDumpSheet = useCallback(async () => {
    if (isDumpProcessing || photoOrganizeFlow) return;
    await waitForRCReady();
    if (shouldShowPaywall()) {
      const result = await rcRef.current?.presentPaywall();
      if (!result?.isPro) {
        if (result?.error) setError(result.error);
        return;
      }
    }
    leaveVoiceDumpSessionForOtherInput();
    setTypedDumpText("");
    setShowTypedDumpSheet(true);
  }, [isDumpProcessing, photoOrganizeFlow, leaveVoiceDumpSessionForOtherInput, waitForRCReady, shouldShowPaywall]);

  const closeTypedDumpSheet = useCallback(() => {
    setShowTypedDumpSheet(false);
    setTypedDumpText("");
  }, []);

  useEffect(() => {
    organizeRef.current = organize;
  }, [organize]);

  useEffect(() => {
    const st = loadFormState();
    if (!st.organizeInProgress || !st.organizeTranscriptSnapshot?.trim()) return;
    try {
      const last = Number(sessionStorage.getItem("braindump-resume-attempt") || "0");
      if (Date.now() - last < 4000) return;
      sessionStorage.setItem("braindump-resume-attempt", String(Date.now()));
    } catch {
      /* ignore */
    }
    setOrganizeSuccess(t("center.resumingOrganize"));
    const snap = st.organizeTranscriptSnapshot.trim();
    queueMicrotask(() => {
      void organizeRef.current(snap);
    });
  }, [t]);

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

  const [dumpEmptyListHint, setDumpEmptyListHint] = useState(false);

  useEffect(() => {
    onDumpEmptyHintChange?.(dumpEmptyListHint);
  }, [dumpEmptyListHint, onDumpEmptyHintChange]);

  const handleTypedDumpOrganize = useCallback(async () => {
    const text = typedDumpText.trim();
    if (!text || isDumpProcessing) return;
    closeTypedDumpSheet();
    await organizeFromTypedText(text);
  }, [typedDumpText, isDumpProcessing, closeTypedDumpSheet, organizeFromTypedText]);

  useEffect(() => {
    if (!showTypedDumpSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTypedDumpSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTypedDumpSheet, closeTypedDumpSheet]);

  const processingTitle =
    transcribeLoading && !organizeLoading
      ? photoOrganizeFlow
        ? t("center.readingPhoto")
        : t("center.transcribing")
      : t("center.organizingThoughts");
  const reflectionQuestions = Array.from({ length: 10 }, (_, i) => t(`help.q${i + 1}`));

  useEffect(() => {
    if (isDumpProcessing) setShowHelpOverlay(false);
  }, [isDumpProcessing]);

  useEffect(() => {
    onDumpRecordingChange?.(recordState === "recording");
  }, [recordState, onDumpRecordingChange]);

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

  useEffect(() => {
    if (!showDumpOverlay || showHelpOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDumpOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDumpOverlay, showHelpOverlay, closeDumpOverlay]);

  const onDumpFabClick = useCallback(async () => {
    console.log("[dump] fab clicked", { isDumpProcessing, photoOrganizeFlow, recordState, showDumpOverlay });
    if (isDumpProcessing || photoOrganizeFlow) return;
    if (recordState === "recording") {
      void handleStopAndProcess();
      return;
    }
    if (showDumpOverlay) return;
    console.log("[dump] waiting for RC ready…", { disabledReason: rcRef.current?.disabledReason, ready: rcRef.current?.ready, isPro: rcRef.current?.isPro });
    await waitForRCReady();
    const gate = shouldShowPaywall();
    console.log("[dump] RC ready", { disabledReason: rcRef.current?.disabledReason, ready: rcRef.current?.ready, isPro: rcRef.current?.isPro, gate, lastError: rcRef.current?.lastError });
    if (gate) {
      console.log("[dump] showing paywall…");
      const result = await rcRef.current?.presentPaywall();
      console.log("[dump] paywall result", result);
      if (!result?.isPro) {
        if (result?.error) {
          console.warn("[dump] paywall error:", result.error);
          // Show error visibly even before the overlay opens
          window.alert(`Subscription check failed: ${result.error}\n\nCheck the browser console for details.`);
        }
        return;
      }
    }
    openDumpOverlay();
  }, [isDumpProcessing, photoOrganizeFlow, recordState, showDumpOverlay, handleStopAndProcess, openDumpOverlay, waitForRCReady, shouldShowPaywall]);

  useImperativeHandle(
    ref,
    () => ({
      processImageForOrganize,
      openTypedDumpSheet,
      openPhotoCaptureMenu: async () => {
        if (isDumpProcessing || photoOrganizeFlow) return;
        await waitForRCReady();
        if (shouldShowPaywall()) {
          const result = await rcRef.current?.presentPaywall();
          if (!result?.isPro) return;
        }
        leaveVoiceDumpSessionForOtherInput();
        requestAnimationFrame(() => photoAnchorRef.current?.openMenu());
      },
      toggleDumpRecording: () => {
        onDumpFabClick();
      },
    }),
    [processImageForOrganize, openTypedDumpSheet, onDumpFabClick, isDumpProcessing, photoOrganizeFlow, leaveVoiceDumpSessionForOtherInput, waitForRCReady, shouldShowPaywall]
  );

  const dumpPanelContent = (
    <>
      <section className="bd-dump-overlay-body">
        {!isMobile && audioDevices.length > 0 && (
          <div className="bd-dump-mic-row">
            <select
              id="bd-mic-select"
              className="bd-input"
              value={selectedDeviceId}
              onChange={(e) => switchMicAndRestart(e.target.value)}
              disabled={isDumpProcessing}
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
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={64}
                  className="bd-dump-canvas"
                  aria-label="Audio input level"
                />
              </div>
              <div className="bd-dump-recording-actions">
                <div className="bd-dump-timer-row">
                  <span className="bd-dump-timer" aria-live="polite" aria-atomic="true">
                    {recordingElapsed}
                    <span className="bd-dump-timer-hint">{t("center.recordingMaxHint")}</span>
                  </span>
                </div>
                <div className="bd-dump-actions-row">
                  <button
                    type="button"
                    className="bd-btn bd-btn-primary bd-dump-btn-wide"
                    onClick={() => void handleStopAndProcess()}
                    disabled={transcribeLoading || organizeLoading}
                    title={t("center.stopOrganize")}
                    aria-label={t("center.stopOrganize")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    {t("center.stopOrganize")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {!error && (
                <p className="bd-dump-starting-label" aria-live="polite">
                  {t("center.startingMic")}
                </p>
              )}
            </>
          )}
        </div>
      </section>
      {organizeSuccess && <div className="bd-banner-success">{organizeSuccess}</div>}
      {error && (
        <div className="bd-banner-error">
          <span>{error}</span>
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
      {!isMobile && (
        <div className="bd-dump-fab-cluster">
          {dumpEmptyListHint ? <DumpEmptyHintCallout /> : null}
          <div className="bd-dump-fab-row">
            <button
              id="bd-dump-fab"
              className={`bd-dump-fab${recordState === "recording" ? " bd-dump-fab--recording" : ""}`}
              type="button"
              onClick={onDumpFabClick}
              disabled={isDumpProcessing || photoOrganizeFlow}
              title={recordState === "recording" ? t("center.stopOrganize") : t("center.recordNewDump")}
              aria-label={recordState === "recording" ? t("center.stopOrganize") : t("center.recordNewDump")}
            >
              {recordState === "recording" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
      <PhotoCaptureTrigger
        ref={photoAnchorRef}
        anchorOnly
        onFile={(f) => void processImageForOrganize(f)}
        disabled={isDumpProcessing || photoOrganizeFlow}
      />
      {showDumpOverlay && !isDumpProcessing && (
        <div
          className="bd-modal-backdrop bd-dump-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bd-voice-dump-title"
          onClick={closeDumpOverlay}
        >
          <div
            className="bd-panel bd-modal-panel bd-dump-sheet-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="bd-dump-sheet-header">
              <button
                type="button"
                className="bd-btn bd-dump-sheet-header-btn bd-dump-sheet-close-btn"
                onClick={closeDumpOverlay}
                disabled={isDumpProcessing}
                aria-label={t("center.cancelDump")}
                title={t("center.cancelDump")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <h2 id="bd-voice-dump-title" className="bd-dump-sheet-title">
                {t("center.newDump")}
              </h2>
              <button
                type="button"
                className="bd-btn bd-dump-sheet-header-btn bd-dump-sheet-help-btn"
                onClick={() => setShowHelpOverlay(true)}
                aria-label={t("center.help")}
                title={t("center.help")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
            </header>

            {/* Switch input type — skip paywall since user already passed it */}
            <div className="bd-dump-switch-row">
              <button
                type="button"
                className="bd-btn bd-dump-switch-btn"
                disabled={isDumpProcessing}
                onClick={() => {
                  leaveVoiceDumpSessionForOtherInput();
                  setTypedDumpText("");
                  setShowTypedDumpSheet(true);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M7 9h4M7 13h8" />
                </svg>
                {t("center.typeDump")}
              </button>
              <button
                type="button"
                className="bd-btn bd-dump-switch-btn"
                disabled={isDumpProcessing}
                onClick={() => {
                  leaveVoiceDumpSessionForOtherInput();
                  requestAnimationFrame(() => photoAnchorRef.current?.openMenu());
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {t("bottom.photoFromCamera")}
              </button>
            </div>

            <div className="bd-dump-sheet-content">
              {showDumpFace && <DumpListeningFace variant="sheet" />}
              {dumpPanelContent}
            </div>
          </div>
        </div>
      )}
      {showTypedDumpSheet &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="bd-modal-backdrop bd-typed-dump-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bd-typed-dump-title"
            onClick={closeTypedDumpSheet}
          >
            <div className="bd-panel bd-modal-panel bd-typed-dump-panel" onClick={(e) => e.stopPropagation()}>
              <div className="bd-typed-dump-header">
                <h2 id="bd-typed-dump-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  {t("center.typeDumpTitle")}
                </h2>
                <button
                  type="button"
                  className="bd-typed-dump-close"
                  onClick={closeTypedDumpSheet}
                  aria-label={t("center.cancelDump")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <textarea
                className="bd-input bd-typed-dump-textarea"
                value={typedDumpText}
                onChange={(e) => setTypedDumpText(e.target.value)}
                placeholder={t("center.transcriptPlaceholder")}
                autoFocus
                aria-label={t("center.transcript")}
                rows={8}
              />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0.6rem", flexShrink: 0 }}>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  style={{ width: "100%" }}
                  onClick={() => void handleTypedDumpOrganize()}
                  disabled={!typedDumpText.trim() || isDumpProcessing}
                >
                  {t("center.typeDumpOrganize")}
                </button>
                <button type="button" className="bd-btn" style={{ width: "100%" }} onClick={closeTypedDumpSheet}>
                  {t("center.cancelDump")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {(isDumpProcessing || photoOrganizeFlow) &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="bd-dump-processing-overlay" role="status" aria-live="polite" aria-busy="true">
            <div className="bd-dump-processing-inner">
              {showDumpFace && <DumpListeningFace variant="overlay" />}
              <div className="bd-dump-spinner" aria-hidden />
              <p className="bd-dump-processing-title">{processingTitle}</p>
            </div>
          </div>,
          document.body
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
          dueDateFilter={dueDateFilter}
          reloadKey={itemsReloadKey}
          scopeSlot={scopeSlot}
          onMobileTopBarBeforeMenuSlot={onMobileTopBarBeforeMenuSlot}
          onDesktopScopeBeforeFilterSlot={onDesktopScopeBeforeFilterSlot}
          onItemMovedToTrash={onItemMovedToTrash}
          onDumpEmptyListTextHintChange={setDumpEmptyListHint}
          dumpEmptyHintSuppressed={dumpHintSuppressed}
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
});

CenterPanel.displayName = "CenterPanel";
