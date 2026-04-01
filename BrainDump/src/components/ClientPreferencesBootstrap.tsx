"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import {
  BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT,
  fetchAndApplyClientPreferences,
} from "@/lib/client-preferences-sync";

/**
 * After sign-in, loads `User.clientPreferences` into localStorage (or seeds the server from this device if empty).
 */
export function ClientPreferencesBootstrap() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    let cancelled = false;
    void (async () => {
      await fetchAndApplyClientPreferences();
      if (cancelled || typeof window === "undefined") return;
      window.dispatchEvent(new Event(BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT));
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  return null;
}
