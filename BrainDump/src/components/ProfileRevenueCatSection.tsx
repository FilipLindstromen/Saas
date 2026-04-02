"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useRevenueCat } from "@/components/RevenueCatProvider";

/** Profile panel: Filip Lindstrom Pro + RevenueCat paywall / management. */
export function ProfileRevenueCatSection() {
  const { t } = useI18n();
  const rc = useRevenueCat();
  const [busy, setBusy] = useState<"action" | null>(null);

  if (rc.disabledReason === "no_api_key") {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "1rem",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-tertiary)", lineHeight: 1.45 }}>
          {t("revenueCat.devMissingKey")}
        </p>
      </div>
    );
  }

  if (rc.disabledReason === "admin_disabled") {
    return null;
  }

  if (rc.disabledReason === "signed_out") {
    return null;
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-subtle)",
        paddingTop: "1rem",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
        {t("revenueCat.sectionTitle")}
      </h3>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
        {rc.ready
          ? rc.isPro
            ? t("revenueCat.statusPro")
            : t("revenueCat.statusFree")
          : t("revenueCat.statusLoading")}
      </p>

      {rc.lastError ? (
        <p role="alert" style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--danger, #c0392b)" }}>
          {rc.lastError}
        </p>
      ) : null}

      <button
        type="button"
        className="bd-btn bd-btn--primary"
        disabled={!rc.ready || busy !== null}
        style={{ width: "100%" }}
        onClick={() => {
          setBusy("action");
          const action = rc.isPro
            ? rc.openSubscriptionManagement()
            : rc.presentPaywall().then(() => {});
          void action.finally(() => setBusy(null));
        }}
      >
        {busy === "action"
          ? t("revenueCat.openingManage")
          : rc.isPro
            ? t("revenueCat.manageSubscription")
            : t("revenueCat.upgrade")}
      </button>
    </div>
  );
}
