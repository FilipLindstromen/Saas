/** Presentation text animation types. */
export const TEXT_ANIMATION_TYPES = [
  { value: 'drop-center', label: 'Drop to center' },
  { value: 'fade-words', label: 'Fade in word by word' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'slide-left', label: 'Slide from left' },
  { value: 'slide-right', label: 'Slide from right' },
  { value: 'scale', label: 'Scale in' },
  { value: 'none', label: 'None' },
];

const VALID_ANIMATIONS = new Set(TEXT_ANIMATION_TYPES.map((t) => t.value));

export const DEFAULT_PRESENTATION_ANIMATION_RULES = {
  mode: 'smart',
  fixedAnimation: 'slide-up',
  shortMaxWords: 8,
  mediumMaxWords: 18,
  shortAnimation: 'drop-center',
  mediumAnimation: 'fade-words',
  longAnimation: 'fade-words',
  wordStaggerMs: 70,
  enterDurationMs: 380,
  exitDurationMs: 400,
};

function clampInt(val, min, max, fallback) {
  const n = Math.round(Number(val));
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizePresentationAnimationRules(raw) {
  const d = DEFAULT_PRESENTATION_ANIMATION_RULES;
  if (!raw || typeof raw !== 'object') return { ...d };

  const pickAnim = (val, fallback) =>
    typeof val === 'string' && VALID_ANIMATIONS.has(val) ? val : fallback;

  let shortMax = clampInt(raw.shortMaxWords, 1, 40, d.shortMaxWords);
  let mediumMax = clampInt(raw.mediumMaxWords, shortMax + 1, 80, d.mediumMaxWords);
  if (mediumMax <= shortMax) mediumMax = shortMax + 1;

  return {
    mode: raw.mode === 'fixed' ? 'fixed' : 'smart',
    fixedAnimation: pickAnim(raw.fixedAnimation, d.fixedAnimation),
    shortMaxWords: shortMax,
    mediumMaxWords: mediumMax,
    shortAnimation: pickAnim(raw.shortAnimation, d.shortAnimation),
    mediumAnimation: pickAnim(raw.mediumAnimation, d.mediumAnimation),
    longAnimation: pickAnim(raw.longAnimation, d.longAnimation),
    wordStaggerMs: clampInt(raw.wordStaggerMs, 20, 200, d.wordStaggerMs),
    enterDurationMs: clampInt(raw.enterDurationMs, 100, 2000, d.enterDurationMs),
    exitDurationMs: clampInt(raw.exitDurationMs, 100, 2000, d.exitDurationMs),
  };
}

export function countWords(text) {
  if (!text || !String(text).trim()) return 0;
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

export function splitSentenceWords(text) {
  if (!text || !String(text).trim()) return [];
  return String(text).trim().split(/\s+/).filter(Boolean);
}

export function getSentenceLengthCategory(sentence, rules) {
  const normalized = normalizePresentationAnimationRules(rules);
  const words = countWords(sentence);
  if (words <= normalized.shortMaxWords) return 'short';
  if (words <= normalized.mediumMaxWords) return 'medium';
  return 'long';
}

export function resolveAnimationForSentence(sentence, rules, globalFallback = 'slide-up') {
  const normalized = normalizePresentationAnimationRules(rules);
  if (normalized.mode === 'fixed') {
    return normalized.fixedAnimation;
  }
  const category = getSentenceLengthCategory(sentence, normalized);
  if (category === 'short') return normalized.shortAnimation;
  if (category === 'medium') return normalized.mediumAnimation;
  return normalized.longAnimation;
}

/** Exit animation mirrors enter — drop-center drops down on exit; fade-words exits first word to last. */
export function getExitAnimation(enterAnimation) {
  switch (enterAnimation) {
    case 'drop-center':
      return 'drop-center';
    case 'fade-words':
      return 'fade-words';
    case 'slide-up':
      return 'slide-down';
    case 'slide-left':
      return 'slide-right';
    case 'slide-right':
      return 'slide-left';
    case 'scale':
      return 'scale-out';
    case 'fade':
      return 'fade';
    case 'none':
      return 'none';
    default:
      return 'fade';
  }
}

/** CSS custom properties for present-mode sentence animations. */
export function presentationTimingStyle(rules) {
  const n = normalizePresentationAnimationRules(rules);
  return {
    '--present-enter-duration': `${n.enterDurationMs}ms`,
    '--present-exit-duration': `${n.exitDurationMs}ms`,
  };
}

export function getEnterDurationMs(sentence, animation, rules) {
  const normalized = normalizePresentationAnimationRules(rules);
  if (animation === 'fade-words') {
    const words = countWords(sentence);
    return normalized.enterDurationMs + Math.max(0, words - 1) * normalized.wordStaggerMs;
  }
  if (animation === 'none') return 0;
  return normalized.enterDurationMs;
}

export function getExitDurationMs(exitAnimation, sentence = '', rules) {
  const normalized = normalizePresentationAnimationRules(rules);
  if (exitAnimation === 'none') return 0;
  if (exitAnimation === 'fade-words') {
    const words = countWords(sentence);
    return normalized.exitDurationMs + Math.max(0, words - 1) * normalized.wordStaggerMs;
  }
  return normalized.exitDurationMs;
}
