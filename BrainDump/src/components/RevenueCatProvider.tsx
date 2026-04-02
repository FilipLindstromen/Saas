"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { CustomerInfo } from "@revenuecat/purchases-js";
import { useSiteConfig } from "@/components/SiteConfigProvider";
import { getRevenueCatEntitlementId, getRevenueCatPublicApiKey } from "@/lib/revenuecat/constants";
import { isUserCancelledPurchasesError, purchasesErrorMessage } from "@/lib/revenuecat/errors";

export type RevenueCatDisabledReason = "no_api_key" | "admin_disabled" | "signed_out" | null;

type RevenueCatContextValue = {
  /** SDK configured and customer info loaded at least once (or attempt finished). */
  ready: boolean;
  disabledReason: RevenueCatDisabledReason;
  entitlementId: string;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  lastError: string | null;
  refreshCustomerInfo: () => Promise<void>;
  /** RevenueCat-hosted paywall (full-screen if no htmlTarget). Resolves after flow completes.
   *  Returns `isPro: true` if the user has an active entitlement after the flow (purchased or already had one).
   *  Returns `error` when the SDK could not show the paywall (misconfiguration, network, etc.). */
  presentPaywall: (options?: { htmlTarget?: HTMLElement | null }) => Promise<{ isPro: boolean; error?: string }>;
  /** Opens subscription management (Stripe portal / store) when available. */
  openSubscriptionManagement: () => Promise<void>;
};

const RevenueCatContext = createContext<RevenueCatContextValue | undefined>(undefined);

function entitlementActive(info: CustomerInfo | null, entitlementId: string): boolean {
  if (!info) return false;
  return entitlementId in info.entitlements.active;
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const { revenueCatEnabled, siteConfigLoading } = useSiteConfig();
  const apiKey = getRevenueCatPublicApiKey();
  const entitlementId = getRevenueCatEntitlementId();

  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const userEmail = session?.user?.email ?? undefined;

  const [ready, setReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const configuredForUserRef = useRef<string | null>(null);

  const disabledReason: RevenueCatDisabledReason = useMemo(() => {
    if (!revenueCatEnabled) return "admin_disabled";
    if (!apiKey) return "no_api_key";
    if (status !== "authenticated" || !userId) return "signed_out";
    return null;
  }, [apiKey, revenueCatEnabled, status, userId]);

  const refreshCustomerInfo = useCallback(async () => {
    if (disabledReason) return;
    const { Purchases } = await import("@revenuecat/purchases-js");
    if (!Purchases.isConfigured()) return;
    try {
      const info = await Purchases.getSharedInstance().getCustomerInfo();
      setCustomerInfo(info);
      setLastError(null);
    } catch (e) {
      setLastError(purchasesErrorMessage(e) ?? "Failed to load subscription status");
    }
  }, [disabledReason]);

  useEffect(() => {
    if (siteConfigLoading) return;

    let cancelled = false;

    async function sync() {
      setReady(false);
      setLastError(null);

      if (disabledReason) {
        try {
          const { Purchases } = await import("@revenuecat/purchases-js");
          if (Purchases.isConfigured()) {
            Purchases.getSharedInstance().close();
          }
        } catch {
          /* ignore */
        }
        configuredForUserRef.current = null;
        setCustomerInfo(null);
        setReady(true);
        return;
      }

      try {
        const { Purchases, LogLevel } = await import("@revenuecat/purchases-js");
        await import("@revenuecat/purchases-js/styles");

        if (process.env.NODE_ENV === "development") {
          Purchases.setLogLevel(LogLevel.Warn);
        }

        if (!Purchases.isConfigured()) {
          Purchases.configure({ apiKey: apiKey!, appUserId: userId! });
          configuredForUserRef.current = userId;
        } else {
          const inst = Purchases.getSharedInstance();
          const current = inst.getAppUserId();
          if (current !== userId) {
            await inst.changeUser(userId!);
            configuredForUserRef.current = userId;
          }
        }

        const info = await Purchases.getSharedInstance().getCustomerInfo();
        if (!cancelled) {
          setCustomerInfo(info);
          setLastError(null);
        }
      } catch (e) {
        console.error("[RevenueCat] SDK init error:", e);
        if (!cancelled) {
          setCustomerInfo(null);
          setLastError(purchasesErrorMessage(e) ?? "RevenueCat configuration failed");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [apiKey, disabledReason, siteConfigLoading, userId]);

  const presentPaywall = useCallback(
    async (options?: { htmlTarget?: HTMLElement | null }): Promise<{ isPro: boolean; error?: string }> => {
      if (disabledReason) return { isPro: false };
      setLastError(null);
      try {
        const { Purchases } = await import("@revenuecat/purchases-js");
        if (!Purchases.isConfigured()) {
          const msg = "Subscription system not ready";
          setLastError(msg);
          return { isPro: false, error: msg };
        }
        const inst = Purchases.getSharedInstance();

        // Fetch the current offering — required for presentPaywall to know what to display.
        const offerings = await inst.getOfferings();
        const currentOffering = offerings.current;
        if (!currentOffering) {
          const msg = "No active offering found in RevenueCat. Make sure a default offering is published.";
          console.error("[RevenueCat]", msg);
          setLastError(msg);
          return { isPro: false, error: msg };
        }

        const openManagement = async () => {
          try {
            const info = await inst.getCustomerInfo();
            if (info.managementURL) {
              window.open(info.managementURL, "_blank", "noopener,noreferrer");
            }
          } catch {
            /* ignore */
          }
        };

        const result = await inst.presentPaywall({
          offering: currentOffering,
          htmlTarget: options?.htmlTarget ?? undefined,
          customerEmail: userEmail,
          onVisitCustomerCenter: () => {
            void openManagement();
          },
          onPurchaseError: (err) => {
            console.warn("[RevenueCat] paywall purchase error", err);
          },
        });

        // Compute isPro synchronously from the fresh CustomerInfo before any React re-render.
        const nowPro = entitlementActive(result.customerInfo, entitlementId);
        setCustomerInfo(result.customerInfo);
        return { isPro: nowPro };
      } catch (e) {
        if (isUserCancelledPurchasesError(e)) return { isPro: false };
        const msg = purchasesErrorMessage(e);
        if (msg) setLastError(msg);
        return { isPro: false, error: msg ?? undefined };
      }
    },
    [disabledReason, entitlementId, userEmail]
  );

  const openSubscriptionManagement = useCallback(async () => {
    if (disabledReason) return;
    setLastError(null);
    try {
      const { Purchases } = await import("@revenuecat/purchases-js");
      if (!Purchases.isConfigured()) return;
      const info = await Purchases.getSharedInstance().getCustomerInfo();
      setCustomerInfo(info);
      if (info.managementURL) {
        window.open(info.managementURL, "_blank", "noopener,noreferrer");
      } else {
        setLastError("No active subscription to manage on the web yet.");
      }
    } catch (e) {
      const msg = purchasesErrorMessage(e);
      if (msg) setLastError(msg);
    }
  }, [disabledReason]);

  const value = useMemo<RevenueCatContextValue>(
    () => ({
      ready: ready && !siteConfigLoading,
      disabledReason,
      entitlementId,
      isPro: entitlementActive(customerInfo, entitlementId),
      customerInfo,
      lastError,
      refreshCustomerInfo,
      presentPaywall,
      openSubscriptionManagement,
    }),
    [
      customerInfo,
      disabledReason,
      entitlementId,
      lastError,
      presentPaywall,
      openSubscriptionManagement,
      ready,
      refreshCustomerInfo,
      siteConfigLoading,
    ]
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatContextValue {
  const ctx = useContext(RevenueCatContext);
  if (ctx === undefined) {
    throw new Error("useRevenueCat must be used within RevenueCatProvider");
  }
  return ctx;
}

/** Returns undefined if RevenueCatProvider is not mounted. */
export function useRevenueCatOptional(): RevenueCatContextValue | undefined {
  return useContext(RevenueCatContext);
}
