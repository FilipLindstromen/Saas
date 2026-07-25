/** Last organized batch (for "New" filter). Replaced on each successful save from a dump. */

export const BRAINDUMP_NEW_BATCH_IDS_KEY = "braindump_new_batch_ids";

/** DOM event fired when the "new batch" id set changes (same as `subscribeNewBatch`). */
export const BRAINDUMP_NEW_BATCH_EVENT = "braindump-new-batch";

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BRAINDUMP_NEW_BATCH_EVENT));
}

export function saveLastNewBatchIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BRAINDUMP_NEW_BATCH_IDS_KEY, JSON.stringify(ids));
    void import("@/lib/client-preferences-sync").then((m) => m.scheduleClientPreferencesUpload());
  } catch {
    /* ignore */
  }
  notify();
}

export function getLastNewBatchIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(BRAINDUMP_NEW_BATCH_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Drop batch ids that no longer exist (deleted/trashed); returns remaining count. */
export function pruneLastNewBatchIds(validIds: Set<string>): number {
  const stored = getLastNewBatchIds();
  if (stored.size === 0) return 0;
  const kept = [...stored].filter((id) => validIds.has(id));
  if (kept.length === stored.size) return kept.length;
  saveLastNewBatchIds(kept);
  return kept.length;
}

export function countNewBatchItems(items: { id: string }[]): number {
  const ids = getLastNewBatchIds();
  if (ids.size === 0) return 0;
  let n = 0;
  for (const it of items) {
    if (ids.has(it.id)) n += 1;
  }
  return n;
}

/** Subscribe to changes in the last batch id set (save or clear). */
export function subscribeNewBatch(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(BRAINDUMP_NEW_BATCH_EVENT, listener);
  return () => window.removeEventListener(BRAINDUMP_NEW_BATCH_EVENT, listener);
}
