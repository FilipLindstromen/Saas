/**
 * Persist form inputs to localStorage so they survive page reloads.
 */

const STORAGE_KEY = "contentgenerator-form-settings";

export interface GeneratorFormState {
  audience: string;
  theme: string;
  tone: string[];
  format: string[];
  platform: string[];
  intensity: number;
  context: string;
  numQuestions: number;
  generateHooks: boolean;
  saveToLibrary: boolean;
  showPromptPreview: boolean;
}

export interface ScanFormState {
  subredditsInput: string;
  timeRange: string;
  sort: string;
}

const DEFAULT_GENERATOR: GeneratorFormState = {
  audience: "",
  theme: "Stress",
  tone: [],
  format: [],
  platform: [],
  intensity: 1,
  context: "",
  numQuestions: 10,
  generateHooks: true,
  saveToLibrary: true,
  showPromptPreview: false,
};

const DEFAULT_SCAN: ScanFormState = {
  subredditsInput: "",
  timeRange: "week",
  sort: "top",
};

export function loadGeneratorState(): GeneratorFormState {
  if (typeof window === "undefined") return DEFAULT_GENERATOR;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GENERATOR;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_GENERATOR,
      ...parsed.generator,
      tone: Array.isArray(parsed.generator?.tone) ? parsed.generator.tone : DEFAULT_GENERATOR.tone,
      format: Array.isArray(parsed.generator?.format) ? parsed.generator.format : DEFAULT_GENERATOR.format,
      platform: Array.isArray(parsed.generator?.platform) ? parsed.generator.platform : DEFAULT_GENERATOR.platform,
    };
  } catch {
    return DEFAULT_GENERATOR;
  }
}

export function loadScanState(): ScanFormState {
  if (typeof window === "undefined") return DEFAULT_SCAN;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCAN;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SCAN, ...parsed.scan };
  } catch {
    return DEFAULT_SCAN;
  }
}

export function saveGeneratorState(state: Partial<GeneratorFormState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadGeneratorState();
    const next = { ...current, ...state };
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    stored.generator = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn("Failed to save generator state:", e);
  }
}

export function saveScanState(state: Partial<ScanFormState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadScanState();
    const next = { ...current, ...state };
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    stored.scan = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn("Failed to save scan state:", e);
  }
}
