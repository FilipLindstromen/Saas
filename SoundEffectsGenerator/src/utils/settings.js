import { loadApiKeys } from '@shared/apiKeys';

const STORAGE_KEY = 'soundeffects_settings';

export function getSettings() {
  const apiKeys = loadApiKeys();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      openaiApiKey: apiKeys.openai ?? '',
      elevenlabsApiKey: apiKeys.elevenlabs ?? '',
      apiBaseUrl: parsed.apiBaseUrl ?? '',
    };
  } catch {
    return {
      openaiApiKey: apiKeys.openai ?? '',
      elevenlabsApiKey: apiKeys.elevenlabs ?? '',
      apiBaseUrl: '',
    };
  }
}

export function saveSettings(settings) {
  const apiKeys = loadApiKeys();
  const next = {
    apiBaseUrl: String(settings.apiBaseUrl ?? '').trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { openaiApiKey: apiKeys.openai, elevenlabsApiKey: apiKeys.elevenlabs, ...next };
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
