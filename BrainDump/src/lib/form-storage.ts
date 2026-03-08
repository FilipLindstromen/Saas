/**
 * Persist BrainDump in-progress state to localStorage (transcript, current dump id, etc.)
 */

const STORAGE_KEY = "braindump-form-state";

export interface BrainDumpFormState {
  transcriptRaw: string;
  transcriptEdited: string;
  currentDumpId: string | null;
  lastMode: string;
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
