/**
 * Persist BrainDump in-progress state to localStorage (transcript, current dump id, etc.)
 */

const STORAGE_KEY = "braindump-form-state";

export interface BrainDumpFormState {
  transcriptRaw: string;
  transcriptEdited: string;
  currentDumpId: string | null;
  lastMode: string;
  /** Organization was in flight (user closed app / network drop) — resume on next load. */
  organizeInProgress?: boolean;
  /** Transcript snapshot for resume (must match what was being organized). */
  organizeTranscriptSnapshot?: string;
}

const DEFAULT: BrainDumpFormState = {
  transcriptRaw: "",
  transcriptEdited: "",
  currentDumpId: null,
  lastMode: "inbox",
};

export function loadFormState(): BrainDumpFormState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function saveFormState(state: Partial<BrainDumpFormState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadFormState();
    const next = { ...current, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("Failed to save BrainDump form state:", e);
  }
}

export function clearFormState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ── Debug: last organize snapshot ────────────────────────────────────────────

const DEBUG_KEY = "braindump-debug-last-organize";

export interface DebugOrganizeSnapshot {
  rawTranscript: string;
  organizedItems: unknown[];
  organizedAt: string;
}

export function saveDebugSnapshot(raw: string, items: unknown[]): void {
  if (typeof window === "undefined") return;
  try {
    const snapshot: DebugOrganizeSnapshot = {
      rawTranscript: raw,
      organizedItems: items,
      organizedAt: new Date().toISOString(),
    };
    localStorage.setItem(DEBUG_KEY, JSON.stringify(snapshot));
  } catch {}
}

export function loadDebugSnapshot(): DebugOrganizeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEBUG_KEY);
    return raw ? (JSON.parse(raw) as DebugOrganizeSnapshot) : null;
  } catch {
    return null;
  }
}
