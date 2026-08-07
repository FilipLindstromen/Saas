import { isValidTargetOutcomeId } from '../constants/targetOutcomes';
import { normalizePresentationAnimationRules } from './textAnimations';
import { normalizeHeadlineSpans } from './headlines';
import { normalizePresentStyleSpans } from './presentStyles';
import {
  normalizePresentSceneImages,
  normalizePresentSceneImageLocks,
  migratePresentSceneImagesFromLegacy,
  migratePresentSceneImageLocksFromLegacy,
} from './presentSceneImages';

function persistHeadlineSpans(spans, contentLength) {
  return normalizeHeadlineSpans(spans, contentLength).map(({ start, end }) => ({ start, end }));
}

function persistPresentStyleSpans(spans, contentLength) {
  return normalizePresentStyleSpans(spans, contentLength).map(({ start, end, style }) => ({
    start,
    end,
    style,
  }));
}

function persistSpanRanges(spans, contentLength) {
  return normalizeHeadlineSpans(spans, contentLength).map(({ start, end }) => ({ start, end }));
}

function persistRotateSpans(spans, contentLength) {
  return persistSpanRanges(spans, contentLength);
}

function persistBulletSpans(spans, contentLength) {
  return persistSpanRanges(spans, contentLength);
}

function persistSentenceImageLocks(locks) {
  if (!Array.isArray(locks)) return [];
  return locks.map((x) => Boolean(x));
}

const STORAGE_KEY = 'storywriter_content';

let cached = null;

function loadRaw() {
  if (cached !== null) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    cached = JSON.parse(raw);
    return cached;
  } catch {
    return null;
  }
}

const DEFAULT_FRAMEWORK_ID = 'heros_arc';
const DEFAULT_TARGET_OUTCOME_ID = 'general';

/** Normalize raw story data; validates and merges with defaults. */
export function normalizeStoryData(raw, getDefaultSectionOrder, createEmptySections) {
  const frameworkId =
    raw && typeof raw.frameworkId === 'string' ? raw.frameworkId : DEFAULT_FRAMEWORK_ID;
  const validOrder = getDefaultSectionOrder(frameworkId);
  const empty = createEmptySections(frameworkId);
  const defaults = {
    storyAbout: '',
    frameworkId,
    sectionOrder: validOrder,
    sectionsData: empty,
    storyLength: 'medium',
    targetOutcome: DEFAULT_TARGET_OUTCOME_ID,
    presentationAnimationRules: normalizePresentationAnimationRules(null),
  };
  if (!raw || typeof raw !== 'object') return defaults;
  const sectionOrder = Array.isArray(raw.sectionOrder) ? raw.sectionOrder : null;
  const sectionsData =
    raw.sectionsData && typeof raw.sectionsData === 'object' ? raw.sectionsData : null;
  const validIds = new Set(validOrder);
  let order = sectionOrder
    ? sectionOrder.filter((id) => validIds.has(id)).concat(validOrder.filter((id) => !sectionOrder.includes(id)))
    : validOrder;
  if (order.length !== validOrder.length) {
    const missing = validOrder.filter((id) => !order.includes(id));
    order = order.concat(missing);
  }
  let data = empty;
  if (sectionsData) {
    data = { ...empty };
    for (const id of validOrder) {
      if (sectionsData[id] && typeof sectionsData[id] === 'object') {
        const sentenceImages = sectionsData[id].sentenceImages;
        const arr = Array.isArray(sentenceImages)
          ? sentenceImages.map((x) => (typeof x === 'string' ? x : ''))
          : [];
        const content = sectionsData[id].content ?? empty[id].content;
        const presentSceneImages = migratePresentSceneImagesFromLegacy(
          content,
          sectionsData[id].presentSceneImages,
          arr
        );
        const presentSceneImageLocks = migratePresentSceneImageLocksFromLegacy(
          content,
          sectionsData[id].presentSceneImageLocks,
          sectionsData[id].sentenceImageLocks,
          presentSceneImages,
          arr
        );
        data[id] = {
          input: sectionsData[id].input ?? empty[id].input,
          content,
          backgroundImageUrl: typeof sectionsData[id].backgroundImageUrl === 'string' ? sectionsData[id].backgroundImageUrl : undefined,
          backgroundImageCredit: typeof sectionsData[id].backgroundImageCredit === 'string' ? sectionsData[id].backgroundImageCredit : undefined,
          sentenceImages: arr,
          sentenceImageLocks: persistSentenceImageLocks(sectionsData[id].sentenceImageLocks),
          presentSceneImages,
          presentSceneImageLocks,
          headlineSpans: persistHeadlineSpans(sectionsData[id].headlineSpans, String(content).length),
          rotateLineSpans: persistRotateSpans(sectionsData[id].rotateLineSpans, String(content).length),
          bulletLineSpans: persistBulletSpans(sectionsData[id].bulletLineSpans, String(content).length),
          presentStyleSpans: persistPresentStyleSpans(sectionsData[id].presentStyleSpans, String(content).length),
        };
      }
    }
  }
  return {
    storyAbout: typeof raw.storyAbout === 'string' ? raw.storyAbout : '',
    frameworkId,
    sectionOrder: order,
    sectionsData: data,
    storyLength:
      raw.storyLength === 'micro' || raw.storyLength === 'short' || raw.storyLength === 'medium' || raw.storyLength === 'long'
        ? raw.storyLength
        : 'medium',
    targetOutcome:
      typeof raw.targetOutcome === 'string' && isValidTargetOutcomeId(raw.targetOutcome)
        ? raw.targetOutcome
        : DEFAULT_TARGET_OUTCOME_ID,
    presentationAnimationRules: normalizePresentationAnimationRules(raw.presentationAnimationRules),
  };
}

/** Load saved content; validates and merges with defaults. Returns default object if none saved. */
export function loadContent(getDefaultSectionOrder, createEmptySections) {
  return normalizeStoryData(loadRaw(), getDefaultSectionOrder, createEmptySections);
}

export function saveContent(payload) {
  try {
    const sections = payload.sectionsData ?? {};
    const sectionsData = {};
    for (const [id, section] of Object.entries(sections)) {
      if (section && typeof section === 'object') {
        const sentenceImages = section.sentenceImages;
        const arr = Array.isArray(sentenceImages)
          ? sentenceImages.map((x) => (typeof x === 'string' ? x : ''))
          : [];
        const content = section.content ?? '';
        const presentSceneImages = migratePresentSceneImagesFromLegacy(
          content,
          section.presentSceneImages,
          arr
        );
        const presentSceneImageLocks = migratePresentSceneImageLocksFromLegacy(
          content,
          section.presentSceneImageLocks,
          section.sentenceImageLocks,
          presentSceneImages,
          arr
        );
        sectionsData[id] = {
          input: section.input ?? '',
          content,
          backgroundImageUrl: typeof section.backgroundImageUrl === 'string' ? section.backgroundImageUrl : undefined,
          backgroundImageCredit: typeof section.backgroundImageCredit === 'string' ? section.backgroundImageCredit : undefined,
          sentenceImages: arr,
          sentenceImageLocks: persistSentenceImageLocks(section.sentenceImageLocks),
          presentSceneImages,
          presentSceneImageLocks,
          headlineSpans: persistHeadlineSpans(section.headlineSpans, String(content).length),
          rotateLineSpans: persistRotateSpans(section.rotateLineSpans, String(content).length),
          bulletLineSpans: persistBulletSpans(section.bulletLineSpans, String(content).length),
          presentStyleSpans: persistPresentStyleSpans(section.presentStyleSpans, String(content).length),
        };
      }
    }
    const toSave = {
      storyAbout: payload.storyAbout ?? '',
      frameworkId: payload.frameworkId ?? DEFAULT_FRAMEWORK_ID,
      sectionOrder: payload.sectionOrder ?? [],
      sectionsData,
      storyLength: payload.storyLength ?? 'medium',
      targetOutcome: payload.targetOutcome ?? DEFAULT_TARGET_OUTCOME_ID,
      presentationAnimationRules: normalizePresentationAnimationRules(payload.presentationAnimationRules),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (_) {}
}
