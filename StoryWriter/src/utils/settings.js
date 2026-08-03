import { loadApiKeys, saveApiKeys } from '@shared/apiKeys';

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

/** Text animation when advancing sentences in Present mode (global fallback). */
export const TEXT_ANIMATION_OPTIONS = [
  { value: 'drop-center', label: 'Drop to center' },
  { value: 'fade-words', label: 'Fade in word by word' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide from left' },
  { value: 'slide-right', label: 'Slide from right' },
  { value: 'scale', label: 'Scale in' },
  { value: 'none', label: 'None' },
];

/** Fixed result count for Edit → stock media sentence picker. */
export const EDIT_STOCK_RESULTS_COUNT = 30;

/** How many Unsplash thumbnails to load in Edit → sentence image picker. */
export const UNSPLASH_RESULT_COUNT_OPTIONS = [
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 12, label: '12' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
];

/** Sentence background source in Edit mode. */
export const SENTENCE_IMAGE_SOURCE_OPTIONS = [
  { value: 'unsplash', label: 'Unsplash (photos)', shortLabel: 'Unsplash' },
  { value: 'pexels-photo', label: 'Pexels (photos)', shortLabel: 'Pexels · photo' },
  { value: 'pexels-video', label: 'Pexels (videos)', shortLabel: 'Pexels · video' },
  { value: 'pixabay-photo', label: 'Pixabay (photos)', shortLabel: 'Pixabay · photo' },
  { value: 'pixabay-video', label: 'Pixabay (videos)', shortLabel: 'Pixabay · video' },
  { value: 'ai-sketch', label: 'AI napkin sketch', shortLabel: 'AI sketch' },
  { value: 'import', label: 'Import image', shortLabel: 'Import' },
];

const defaults = {
  openaiApiKey: '',
  presentationFont: 'Poppins',
  presentationFontSize: 'medium',
  presentationLineHeight: '1.4',
  unsplashAccessKey: '',
  pexelsApiKey: '',
  pixabayApiKey: '',
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
  editImageSearchOnLineClick: true,
  editUnsplashResultsCount: 12,
  editSentenceImageSource: 'unsplash',
  editSketchGenerationInstructions: '',
};

export function getSettings() {
  const apiKeys = loadApiKeys();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaults,
        openaiApiKey: apiKeys.openai,
        unsplashAccessKey: apiKeys.unsplash,
        pexelsApiKey: apiKeys.pexels,
        pixabayApiKey: apiKeys.pixabay,
      };
    }
    const parsed = JSON.parse(raw);
    const opacity = parsed.presentationBackgroundOpacity;
    return {
      ...defaults,
      ...parsed,
      openaiApiKey: apiKeys.openai || '',
      unsplashAccessKey: apiKeys.unsplash || '',
      pexelsApiKey: apiKeys.pexels || '',
      pixabayApiKey: apiKeys.pixabay || '',
      presentationBackgroundOpacity:
        typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : defaults.presentationBackgroundOpacity,
      editImageSearchOnLineClick:
        parsed.editImageSearchOnLineClick !== undefined
          ? Boolean(parsed.editImageSearchOnLineClick)
          : defaults.editImageSearchOnLineClick,
      editUnsplashResultsCount: UNSPLASH_RESULT_COUNT_OPTIONS.some(
        (o) => o.value === Number(parsed.editUnsplashResultsCount)
      )
        ? Number(parsed.editUnsplashResultsCount)
        : defaults.editUnsplashResultsCount,
      editSentenceImageSource: SENTENCE_IMAGE_SOURCE_OPTIONS.some(
        (o) => o.value === parsed.editSentenceImageSource
      )
        ? parsed.editSentenceImageSource
        : defaults.editSentenceImageSource,
      editSketchGenerationInstructions:
        typeof parsed.editSketchGenerationInstructions === 'string'
          ? parsed.editSketchGenerationInstructions.slice(0, 2000)
          : defaults.editSketchGenerationInstructions,
    };
  } catch {
    return {
      ...defaults,
      openaiApiKey: apiKeys.openai,
      unsplashAccessKey: apiKeys.unsplash,
      pexelsApiKey: apiKeys.pexels,
      pixabayApiKey: apiKeys.pixabay,
    };
  }
}

export function saveSettings(settings) {
  const font = String(settings.presentationFont ?? defaults.presentationFont).trim();
  const size = String(settings.presentationFontSize ?? defaults.presentationFontSize).trim();
  const opacity = settings.presentationBackgroundOpacity;
  const apiKeys = loadApiKeys();
  const openaiKey =
    settings.openaiApiKey !== undefined
      ? String(settings.openaiApiKey ?? '').trim()
      : apiKeys.openai || '';
  const unsplashKey =
    settings.unsplashAccessKey !== undefined
      ? String(settings.unsplashAccessKey ?? '').trim()
      : apiKeys.unsplash || '';
  const pexelsKey =
    settings.pexelsApiKey !== undefined
      ? String(settings.pexelsApiKey ?? '').trim()
      : apiKeys.pexels || '';
  const pixabayKey =
    settings.pixabayApiKey !== undefined
      ? String(settings.pixabayApiKey ?? '').trim()
      : apiKeys.pixabay || '';

  if (
    settings.openaiApiKey !== undefined ||
    settings.unsplashAccessKey !== undefined ||
    settings.pexelsApiKey !== undefined ||
    settings.pixabayApiKey !== undefined
  ) {
    saveApiKeys({
      ...apiKeys,
      openai: openaiKey,
      unsplash: unsplashKey,
      pexels: pexelsKey,
      pixabay: pixabayKey,
    });
  }

  const next = {
    openaiApiKey: openaiKey,
    unsplashAccessKey: unsplashKey,
    pexelsApiKey: pexelsKey,
    pixabayApiKey: pixabayKey,
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
    editImageSearchOnLineClick:
      settings.editImageSearchOnLineClick !== undefined
        ? Boolean(settings.editImageSearchOnLineClick)
        : defaults.editImageSearchOnLineClick,
    editUnsplashResultsCount: UNSPLASH_RESULT_COUNT_OPTIONS.some(
      (o) => o.value === Number(settings.editUnsplashResultsCount)
    )
      ? Number(settings.editUnsplashResultsCount)
      : defaults.editUnsplashResultsCount,
    editSentenceImageSource: SENTENCE_IMAGE_SOURCE_OPTIONS.some(
      (o) => o.value === settings.editSentenceImageSource
    )
      ? settings.editSentenceImageSource
      : defaults.editSentenceImageSource,
    editSketchGenerationInstructions: String(settings.editSketchGenerationInstructions ?? '')
      .slice(0, 2000),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
