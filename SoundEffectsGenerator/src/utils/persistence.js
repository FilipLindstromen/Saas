const DB_NAME = 'soundeffects_app';
const DB_VERSION = 1;
const STORE_BLOBS = 'blobs';
const STORAGE_KEY = 'soundeffects_app_state';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
  });
}

function getBlob(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? null);
  });
}

function putBlob(db, key, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    const req = tx.objectStore(STORE_BLOBS).put(blob, key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

function deleteBlob(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    const req = tx.objectStore(STORE_BLOBS).delete(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/** Load JSON state from localStorage (no blobs). */
export function loadStateJSON() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Save JSON state to localStorage. */
export function saveStateJSON(data) {
  const safe = {
    transcript: data.transcript ?? null,
    importantMoments: data.importantMoments ?? [],
    momentPrompts: Array.isArray(data.momentPrompts) ? data.momentPrompts : [],
    momentDurations: Array.isArray(data.momentDurations) ? data.momentDurations : [],
    soundDirection: data.soundDirection ?? '',
    overallFeel: data.overallFeel ?? '',
    userImportantFocus: data.userImportantFocus ?? '',
    selectedSegmentIndices: Array.isArray(data.selectedSegmentIndices) ? data.selectedSegmentIndices : [],
    effectDurationMin: data.effectDurationMin ?? 2,
    effectDurationMax: data.effectDurationMax ?? 4,
    audioFileName: data.audioFileName ?? '',
    effectsMetadata: data.effectsMetadata ?? [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
}

/** Save full app state (blobs to IndexedDB, rest to localStorage). */
export async function saveAppState(state) {
  const {
    audioFile,
    transcript,
    importantMoments,
    momentPrompts,
    momentDurations,
    soundDirection,
    overallFeel,
    userImportantFocus,
    selectedSegmentIndices,
    effectDurationMin,
    effectDurationMax,
    effects,
  } = state;

  saveStateJSON({
    transcript,
    importantMoments,
    momentPrompts: Array.isArray(momentPrompts) ? momentPrompts : [],
    momentDurations: Array.isArray(momentDurations) ? momentDurations : [],
    soundDirection,
    overallFeel,
    userImportantFocus: userImportantFocus ?? '',
    selectedSegmentIndices: Array.isArray(selectedSegmentIndices) ? selectedSegmentIndices : [],
    effectDurationMin: effectDurationMin ?? 2,
    effectDurationMax: effectDurationMax ?? 4,
    audioFileName: audioFile?.name ?? '',
    effectsMetadata: (effects || []).map((e) => ({
      start: e.start,
      end: e.end,
      text: e.text,
      reason: e.reason,
      effectType: e.effectType,
      elevenLabsPrompt: e.elevenLabsPrompt,
      index: e.index,
      effectExt: e.effectExt,
      durationSeconds: e.durationSeconds,
    })),
  });

  const db = await openDB();
  try {
    if (audioFile && audioFile instanceof Blob) {
      await putBlob(db, 'audio', audioFile);
    } else {
      await deleteBlob(db, 'audio');
    }
    const keys = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const req = tx.objectStore(STORE_BLOBS).getAllKeys();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    for (const k of keys || []) {
      if (String(k).startsWith('effect_')) await deleteBlob(db, k);
    }
    if (effects?.length) {
      for (let i = 0; i < effects.length; i++) {
        const blob = effects[i].effectBlob;
        if (blob instanceof Blob) await putBlob(db, `effect_${i}`, blob);
      }
    }
  } finally {
    db.close();
  }
}

/** Load full app state from IndexedDB + localStorage. Returns object for setState. */
export async function loadAppState() {
  const json = loadStateJSON();
  const db = await openDB();
  const result = {
    transcript: json?.transcript ?? null,
    importantMoments: json?.importantMoments ?? [],
    momentPrompts: Array.isArray(json?.momentPrompts) ? json.momentPrompts : [],
    momentDurations: Array.isArray(json?.momentDurations) ? json.momentDurations : [],
    soundDirection: json?.soundDirection ?? '',
    overallFeel: json?.overallFeel ?? '',
    userImportantFocus: json?.userImportantFocus ?? '',
    selectedSegmentIndices: Array.isArray(json?.selectedSegmentIndices) ? json.selectedSegmentIndices : [],
    effectDurationMin: Number(json?.effectDurationMin) || 2,
    effectDurationMax: Number(json?.effectDurationMax) || 4,
    audioFile: null,
    audioUrl: null,
    effects: [],
  };

  try {
    const audioBlob = await getBlob(db, 'audio');
    const audioFileName = json?.audioFileName ?? '';
    if (audioBlob && audioFileName) {
      const file = new File([audioBlob], audioFileName, { type: audioBlob.type || 'audio/mpeg' });
      result.audioFile = file;
      result.audioUrl = URL.createObjectURL(audioBlob);
    }

    const meta = json?.effectsMetadata ?? [];
    for (let i = 0; i < meta.length; i++) {
      const blob = await getBlob(db, `effect_${i}`);
      const m = meta[i];
      if (!m) continue;
      result.effects.push({
        ...m,
        effectUrl: blob ? URL.createObjectURL(blob) : '',
        effectBlob: blob ?? null,
        effectExt: m.effectExt || 'mp3',
      });
    }
  } finally {
    db.close();
  }

  return result;
}
