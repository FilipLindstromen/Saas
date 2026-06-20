"use client";

import { useI18n } from "@/lib/i18n";

type Props = {
  count: number;
  onViewNewItems: () => void;
  onDismiss: () => void;
};

export function DumpSuccessBar({ count, onViewNewItems, onDismiss }: Props) {
  const { t } = useI18n();
  return (
    <div className="bd-dump-success-bar" role="status" aria-live="polite">
      <span className="bd-dump-success-bar-text">
        {count === 1 ? t("dumpSuccess.savedOne") : t("dumpSuccess.savedMany", { n: count })}
      </span>
      <div className="bd-dump-success-bar-actions">
        <button type="button" className="bd-btn bd-dump-success-bar-action bd-btn-primary" onClick={onViewNewItems}>
          {t("dumpSuccess.viewNewItems")}
        </button>
        <button type="button" className="bd-btn bd-dump-success-bar-action" onClick={onDismiss}>
          {t("dumpSuccess.dismiss")}
        </button>
      </div>
    </div>
  );
}
