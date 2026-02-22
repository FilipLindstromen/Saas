import { loadApiKeys } from '@shared/apiKeys';

const STORAGE_KEY = 'storywriter_settings';

function clampNum(val, min, max, fallback) {
  const n = Number(val);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

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

/** Line height for presentation text (unitless multiplier). */
export const LINE_HEIGHT_OPTIONS = [
  { value: '1.2', label: '1.2' },
  { value: '1.3', label: '1.3' },
  { value: '1.4', label: '1.4' },
  { value: '1.5', label: '1.5' },
  { value: '1.6', label: '1.6' },
  { value: '1.8', label: '1.8' },
  { value: '2', label: '2' },
];

/** Text animation when advancing sentences in Present mode. */
export const TEXT_ANIMATION_OPTIONS = [
  { value: 'slide-up', label: 'Slide up' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide from left' },
  { value: 'slide-right', label: 'Slide from right' },
  { value: 'scale', label: 'Scale in' },
  { value: 'none', label: 'None' },
];

const defaults = {
  openaiApiKey: '',
  presentationFont: 'Poppins',
  presentationFontSize: 'medium',
  presentationLineHeight: '1.4',
  unsplashAccessKey: '',
  presentationBackgroundOpacity: 0.35,
  presentationWebcamEnabled: false,
  presentationCameraId: '',
  presentationMicrophoneId: '',
  presentationRecordScreen: false,
  presentationBackgroundAnimation: true,
  presentationBackgroundAnimationDuration: 30,
  presentationBackgroundAnimationScale: 1.15,
  presentationTextAnimation: 'slide-up',
  presentationWebcamSize: 'medium',
};

export function getSettings() {
  const apiKeys = loadApiKeys();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults, openaiApiKey: apiKeys.openai, unsplashAccessKey: apiKeys.unsplash };
    const parsed = JSON.parse(raw);
    const opacity = parsed.presentationBackgroundOpacity;
    return {
      ...defaults,
      ...parsed,
      openaiApiKey: apiKeys.openai || '',
      unsplashAccessKey: apiKeys.unsplash || '',
      presentationBackgroundOpacity:
        typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : defaults.presentationBackgroundOpacity,
    };
  } catch {
    return { ...defaults, openaiApiKey: apiKeys.openai, unsplashAccessKey: apiKeys.unsplash };
  }
}

export function saveSettings(settings) {
  const font = String(settings.presentationFont ?? defaults.presentationFont).trim();
  const size = String(settings.presentationFontSize ?? defaults.presentationFontSize).trim();
  const opacity = settings.presentationBackgroundOpacity;
  const apiKeys = loadApiKeys();
  const next = {
    openaiApiKey: apiKeys.openai || '',
    unsplashAccessKey: apiKeys.unsplash || '',
    presentationFont: PRESENTATION_FONTS.includes(font) ? font : defaults.presentationFont,
    presentationFontSize: ['small', 'medium', 'large'].includes(size) ? size : defaults.presentationFontSize,
    presentationLineHeight: LINE_HEIGHT_OPTIONS.some((o) => o.value === settings.presentationLineHeight)
      ? settings.presentationLineHeight
      : defaults.presentationLineHeight,
    presentationBackgroundOpacity:
      typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : defaults.presentationBackgroundOpacity,
    presentationWebcamEnabled: Boolean(settings.presentationWebcamEnabled),
    presentationCameraId: String(settings.presentationCameraId ?? '').trim(),
    presentationMicrophoneId: String(settings.presentationMicrophoneId ?? '').trim(),
    presentationRecordScreen: Boolean(settings.presentationRecordScreen),
    presentationBackgroundAnimation: Boolean(settings.presentationBackgroundAnimation),
    presentationBackgroundAnimationDuration: clampNum(settings.presentationBackgroundAnimationDuration, 1, 30, 10),
    presentationBackgroundAnimationScale: clampNum(settings.presentationBackgroundAnimationScale, 1, 1.5, 1.15),
    presentationTextAnimation: TEXT_ANIMATION_OPTIONS.some((o) => o.value === settings.presentationTextAnimation)
      ? settings.presentationTextAnimation
      : defaults.presentationTextAnimation,
    presentationWebcamSize: ['small', 'medium', 'large'].includes(settings.presentationWebcamSize) ? settings.presentationWebcamSize : 'medium',
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
