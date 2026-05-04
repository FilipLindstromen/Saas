import { defaultData } from "./constants";
import { AppData } from "./types";

const APP_KEY = "ai-content-machine-v1";
const SHARED_KEYS_KEY = "saasApiKeys";

function loadSharedApiKeys(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SHARED_KEYS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function saveSharedApiKeys(keys: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSharedApiKeys();
    localStorage.setItem(SHARED_KEYS_KEY, JSON.stringify({ ...existing, ...keys }));
  } catch {
    // best effort only
  }
}

export function loadAppData(): AppData {
  if (typeof window === "undefined") return defaultData;
  const sharedKeys = loadSharedApiKeys();
  const raw = localStorage.getItem(APP_KEY);
  if (!raw) return { ...defaultData, apiKeys: { ...sharedKeys, ...defaultData.apiKeys } };
  try {
    const parsed = { ...defaultData, ...JSON.parse(raw) } as AppData;
    return { ...parsed, apiKeys: { ...sharedKeys, ...parsed.apiKeys } };
  } catch {
    return { ...defaultData, apiKeys: { ...sharedKeys, ...defaultData.apiKeys } };
  }
}

export function saveAppData(data: AppData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(APP_KEY, JSON.stringify(data));
  saveSharedApiKeys(data.apiKeys);
}

export function resetSeedData() {
  if (typeof window === "undefined") return;
  localStorage.setItem(APP_KEY, JSON.stringify(defaultData));
}
