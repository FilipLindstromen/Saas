import { loadApiKeys, saveApiKeys } from '@shared/apiKeys';

const STORAGE_KEY = 'soundeffects_settings';

const defaults = {
  elevenlabsApiKey: '',
  apiBaseUrl: '',
};

export function getSettings() {
  const apiKeys = loadApiKeys();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      openaiApiKey: apiKeys.openai ?? '',
      elevenlabsApiKey: parsed.elevenlabsApiKey ?? '',
      apiBaseUrl: parsed.apiBaseUrl ?? '',
    };
  } catch {
    return {
      openaiApiKey: apiKeys.openai ?? '',
      elevenlabsApiKey: '',
      apiBaseUrl: '',
    };
  }
}

export function saveSettings(settings) {
  saveApiKeys({ openai: String(settings.openaiApiKey ?? '').trim() });
  const next = {
    elevenlabsApiKey: String(settings.elevenlabsApiKey ?? '').trim(),
    apiBaseUrl: String(settings.apiBaseUrl ?? '').trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { openaiApiKey: loadApiKeys().openai, ...next };
}

/** Base URL for API requests (empty = use relative /api) */
export function getApiBaseUrl() {
  const url = getSettings().apiBaseUrl.trim();
  return url || '/api';
}

/** Headers to send with API requests when keys are set in settings */
export function getApiHeaders() {
  const s = getSettings();
  const headers = {};
  if (s.openaiApiKey) headers['x-openai-api-key'] = s.openaiApiKey;
  if (s.elevenlabsApiKey) headers['x-elevenlabs-api-key'] = s.elevenlabsApiKey;
  return headers;
}
