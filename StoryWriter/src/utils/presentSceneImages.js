import { getPresentScenes, resolveSceneImageUrl } from './sentences';
import { mapOldIndexToNew } from './textEditMap';

export function normalizePresentSceneImages(map) {
  if (!map || typeof map !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    const url = typeof value === 'string' ? value.trim() : '';
    if (url) out[String(key)] = url;
  }
  return out;
}

export function normalizePresentSceneImageLocks(map) {
  if (!map || typeof map !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    if (value) out[String(key)] = true;
  }
  return out;
}

export function isSceneLocked(presentSceneImageLocks, sceneStart) {
  if (sceneStart == null) return false;
  return Boolean(normalizePresentSceneImageLocks(presentSceneImageLocks)[String(sceneStart)]);
}

export function remapPresentSceneImages(oldContent, newContent, oldMap, oldLegacyImages = []) {
  const old = String(oldContent ?? '');
  const next = String(newContent ?? '');
  const oldScenes = getPresentScenes(old, { presentSceneImages: oldMap, sentenceImages: oldLegacyImages });
  const newScenes = getPresentScenes(next);
  if (!oldScenes.length) return normalizePresentSceneImages(oldMap);

  const result = {};
  for (const osc of oldScenes) {
    if (!osc.imageUrl) continue;
    const mappedStart = mapOldIndexToNew(old, next, osc.start);
    const target =
      newScenes.find((nsc) => mappedStart >= nsc.start && mappedStart < nsc.end) ??
      newScenes.find((nsc) => nsc.start === mappedStart);
    if (target && !result[String(target.start)]) {
      result[String(target.start)] = osc.imageUrl;
    }
  }
  return result;
}

export function remapPresentSceneImageLocks(oldContent, newContent, oldLocks, oldMap, oldLegacyImages) {
  const old = String(oldContent ?? '');
  const next = String(newContent ?? '');
  const oldScenes = getPresentScenes(old, { presentSceneImages: oldMap, sentenceImages: oldLegacyImages });
  const newScenes = getPresentScenes(next);
  const result = {};
  const locks = normalizePresentSceneImageLocks(oldLocks);

  for (const osc of oldScenes) {
    if (!locks[String(osc.start)]) continue;
    const mappedStart = mapOldIndexToNew(old, next, osc.start);
    const target =
      newScenes.find((nsc) => mappedStart >= nsc.start && mappedStart < nsc.end) ??
      newScenes.find((nsc) => nsc.start === mappedStart);
    if (target) result[String(target.start)] = true;
  }
  return result;
}

export { getSceneStartForSentenceIndex } from './sentences';

/** Copy legacy per-sentence URLs into per-screen keys when upgrading older projects. */
export function migratePresentSceneImagesFromLegacy(content, presentSceneImages, sentenceImages) {
  const existing = normalizePresentSceneImages(presentSceneImages);
  if (Object.keys(existing).length) return existing;
  const legacy = Array.isArray(sentenceImages) ? sentenceImages : [];
  if (!legacy.some((u) => String(u ?? '').trim())) return existing;

  const scenes = getPresentScenes(String(content ?? ''), { presentSceneImages: {}, sentenceImages: legacy });
  const migrated = { ...existing };
  for (const sc of scenes) {
    const key = String(sc.start);
    if (migrated[key]) continue;
    const url = resolveSceneImageUrl(sc.start, {}, legacy, sc.sentenceIndices);
    if (url) migrated[key] = url;
  }
  return migrated;
}

/** Map legacy per-sentence lock flags to per-screen locks. */
export function migratePresentSceneImageLocksFromLegacy(
  content,
  presentSceneImageLocks,
  sentenceImageLocks,
  presentSceneImages,
  sentenceImages
) {
  const existing = normalizePresentSceneImageLocks(presentSceneImageLocks);
  if (Object.keys(existing).length) return existing;
  const legacyLocks = Array.isArray(sentenceImageLocks) ? sentenceImageLocks : [];
  if (!legacyLocks.some(Boolean)) return existing;

  const scenes = getPresentScenes(String(content ?? ''), {
    presentSceneImages: presentSceneImages ?? {},
    sentenceImages: sentenceImages ?? [],
  });
  const migrated = { ...existing };
  for (const sc of scenes) {
    const key = String(sc.start);
    if (migrated[key]) continue;
    if (sc.sentenceIndices.some((i) => Boolean(legacyLocks[i]))) {
      migrated[key] = true;
    }
  }
  return migrated;
}