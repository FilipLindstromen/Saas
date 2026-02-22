/**
 * Re-export shared API keys for PowerWriter.
 * Keys are stored once and shared across all Saas apps.
 */
// @ts-ignore - shared module is JS
import { loadApiKeys as loadShared, saveApiKeys as saveShared } from "@shared/apiKeys";

export function loadApiKeys(): { openai: string } {
  const keys = loadShared();
  return { openai: keys.openai || "" };
}

export function saveApiKeys(keys: { openai?: string }) {
  saveShared({ openai: keys.openai ?? "" });
}
