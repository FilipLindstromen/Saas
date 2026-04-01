"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Ctx = {
  revenueCatEnabled: boolean;
  siteConfigLoading: boolean;
  refreshSiteConfig: () => void;
};

const SiteConfigContext = createContext<Ctx>({
  revenueCatEnabled: true,
  siteConfigLoading: true,
  refreshSiteConfig: () => {},
});

/** Dispatch after changing site config (e.g. admin RevenueCat toggle) so open tabs refetch. */
export const SITE_CONFIG_CHANGED_EVENT = "braindump-site-config-changed";

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [revenueCatEnabled, setRevenueCatEnabled] = useState(true);
  const [siteConfigLoading, setSiteConfigLoading] = useState(true);

  const refreshSiteConfig = useCallback(() => {
    fetch("/api/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { revenueCatEnabled?: boolean }) => {
        setRevenueCatEnabled(d.revenueCatEnabled !== false);
      })
      .catch(() => {
        setRevenueCatEnabled(true);
      })
      .finally(() => setSiteConfigLoading(false));
  }, []);

  useEffect(() => {
    refreshSiteConfig();
    const handler = () => refreshSiteConfig();
    window.addEventListener(SITE_CONFIG_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SITE_CONFIG_CHANGED_EVENT, handler);
  }, [refreshSiteConfig]);

  return (
    <SiteConfigContext.Provider value={{ revenueCatEnabled, siteConfigLoading, refreshSiteConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
