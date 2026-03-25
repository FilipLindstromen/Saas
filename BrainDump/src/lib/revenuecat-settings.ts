/** Browser-only: gate RevenueCat SDK / paywall so you can develop without keys. */

export const REVENUECAT_ENABLED_STORAGE_KEY = "braindump_revenuecat_enabled";

export const REVENUECAT_ENABLED_CHANGED = "braindump-revenuecat-enabled-changed";

function defaultRevenueCatEnabled(): boolean {
  return process.env.NODE_ENV !== "development";
}

export function loadRevenueCatEnabled(): boolean {
  if (typeof window === "undefined") return defaultRevenueCatEnabled();
  try {
    const v = localStorage.getItem(REVENUECAT_ENABLED_STORAGE_KEY);
    if (v === "true") return true;
    if (v === "false") return false;
    return defaultRevenueCatEnabled();
  } catch {
    return defaultRevenueCatEnabled();
  }
}

export function saveRevenueCatEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REVENUECAT_ENABLED_STORAGE_KEY, enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent(REVENUECAT_ENABLED_CHANGED));
  } catch {
    /* ignore */
  }
}
