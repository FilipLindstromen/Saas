const STORAGE_KEY = 'storywriter_settings';

const defaults = {
  openaiApiKey: '',
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
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
