/** Dispatched after organize returns items so the items list can offer type filters for AI-chosen types. */
export const BRAINDUMP_SUGGESTED_ITEM_TYPES_EVENT = "braindump-suggested-item-types";

export type SuggestedItemTypeDetail = { type: string; domain: string };

export function emitSuggestedItemTypesFromOrganize(
  items: Array<{ item_type: string; domain?: string }>
): void {
  if (typeof window === "undefined" || !items.length) return;
  const detail: SuggestedItemTypeDetail[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const type = (it.item_type || "").trim();
    if (!type) continue;
    const domain = (it.domain || "inbox").trim() || "inbox";
    const key = `${domain}:${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    detail.push({ type, domain });
  }
  if (detail.length === 0) return;
  window.dispatchEvent(new CustomEvent(BRAINDUMP_SUGGESTED_ITEM_TYPES_EVENT, { detail }));
}

/** Whether a dump-suggested type should appear in the type filter for the current workspace mode. */
export function suggestedTypeVisibleForMode(mode: string, domain: string): boolean {
  if (mode === "all") return domain === "work" || domain === "personal" || domain === "inbox";
  if (mode === "work") return domain === "work" || domain === "inbox";
  if (mode === "personal") return domain === "personal" || domain === "inbox";
  if (mode === "inbox") return true;
  return false;
}
