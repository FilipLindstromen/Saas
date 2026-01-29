const STORAGE_KEY = 'soundeffects_settings';

const defaults = {
  openaiApiKey: '',
  elevenlabsApiKey: '',
  apiBaseUrl: '',
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  const next = {
    openaiApiKey: String(settings.openaiApiKey ?? '').trim(),
    elevenlabsApiKey: String(settings.elevenlabsApiKey ?? '').trim(),
    apiBaseUrl: String(settings.apiBaseUrl ?? '').trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
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
