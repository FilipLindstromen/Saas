const GOOGLE_CAL_ACCESS_TOKEN_KEY = "braindump_google_calendar_access_token";
const GOOGLE_CAL_ACCESS_EXPIRES_KEY = "braindump_google_calendar_access_expires_at";

export function saveGoogleCalendarAccessToken(accessToken: string, expiresInSeconds?: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GOOGLE_CAL_ACCESS_TOKEN_KEY, accessToken);
    if (expiresInSeconds != null && expiresInSeconds > 0) {
      localStorage.setItem(GOOGLE_CAL_ACCESS_EXPIRES_KEY, String(Date.now() + expiresInSeconds * 1000));
    } else {
      localStorage.removeItem(GOOGLE_CAL_ACCESS_EXPIRES_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadGoogleCalendarAccessToken(): { token: string | null; expired: boolean } {
  if (typeof window === "undefined") return { token: null, expired: true };
  try {
    const token = localStorage.getItem(GOOGLE_CAL_ACCESS_TOKEN_KEY);
    if (!token) return { token: null, expired: true };
    const expRaw = localStorage.getItem(GOOGLE_CAL_ACCESS_EXPIRES_KEY);
    if (!expRaw) return { token, expired: false };
    const exp = Number(expRaw);
    if (!Number.isFinite(exp)) return { token, expired: false };
    return { token, expired: Date.now() >= exp - 60_000 };
  } catch {
    return { token: null, expired: true };
  }
}

export function clearGoogleCalendarAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GOOGLE_CAL_ACCESS_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_CAL_ACCESS_EXPIRES_KEY);
  } catch {
    /* ignore */
  }
}
