"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useRevenueCat } from "@/components/RevenueCatProvider";

/** Profile panel: Filip Lindstrom Pro + RevenueCat paywall / management. */
export function ProfileRevenueCatSection() {
  const { t } = useI18n();
  const rc = useRevenueCat();
  const [busy, setBusy] = useState<"paywall" | "manage" | "sync" | null>(null);

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

      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <button
          type="button"
          className="bd-btn bd-btn--primary"
          disabled={!rc.ready || busy !== null}
          style={{ width: "100%" }}
          onClick={() => {
            setBusy("paywall");
            void rc
              .presentPaywall()
              .finally(() => setBusy(null));
          }}
        >
          {busy === "paywall" ? t("revenueCat.openingPaywall") : t("revenueCat.upgrade")}
        </button>

        <button
          type="button"
          className="bd-btn"
          disabled={!rc.ready || busy !== null}
          style={{ width: "100%" }}
          onClick={() => {
            setBusy("manage");
            void rc.openSubscriptionManagement().finally(() => setBusy(null));
          }}
        >
          {busy === "manage" ? t("revenueCat.openingManage") : t("revenueCat.manageSubscription")}
        </button>

        <button
          type="button"
          className="bd-btn"
          disabled={!rc.ready || busy !== null}
          style={{ width: "100%" }}
          onClick={() => {
            setBusy("sync");
            void rc.refreshCustomerInfo().finally(() => setBusy(null));
          }}
        >
          {busy === "sync" ? t("revenueCat.syncing") : t("revenueCat.refreshStatus")}
        </button>
      </div>

      <p style={{ margin: "0.65rem 0 0", fontSize: "0.72rem", color: "var(--text-tertiary)", lineHeight: 1.4 }}>
        {t("revenueCat.footerHint")}
      </p>
    </div>
  );
}
