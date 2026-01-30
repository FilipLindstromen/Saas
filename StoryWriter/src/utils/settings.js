const STORAGE_KEY = 'storywriter_settings';

/** Google Fonts suitable for presentation (display name = family name in URL). */
export const PRESENTATION_FONTS = [
  'Poppins',
  'Open Sans',
  'Montserrat',
  'Roboto',
  'Lato',
  'Oswald',
  'Raleway',
  'Playfair Display',
  'Merriweather',
  'Source Sans 3',
];

export const PRESENTATION_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const defaults = {
  openaiApiKey: '',
  presentationFont: 'Poppins',
  presentationFontSize: 'medium',
  unsplashAccessKey: '',
  presentationBackgroundOpacity: 0.35,
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    const opacity = parsed.presentationBackgroundOpacity;
    return {
      ...defaults,
      ...parsed,
      presentationBackgroundOpacity:
        typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : defaults.presentationBackgroundOpacity,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  const font = String(settings.presentationFont ?? defaults.presentationFont).trim();
  const size = String(settings.presentationFontSize ?? defaults.presentationFontSize).trim();
  const opacity = settings.presentationBackgroundOpacity;
  const next = {
    openaiApiKey: String(settings.openaiApiKey ?? '').trim(),
    presentationFont: PRESENTATION_FONTS.includes(font) ? font : defaults.presentationFont,
    presentationFontSize: ['small', 'medium', 'large'].includes(size) ? size : defaults.presentationFontSize,
    unsplashAccessKey: String(settings.unsplashAccessKey ?? '').trim(),
    presentationBackgroundOpacity:
      typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : defaults.presentationBackgroundOpacity,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
