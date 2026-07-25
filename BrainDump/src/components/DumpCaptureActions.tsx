"use client";

import { Mic, List, Camera } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  disabled?: boolean;
  onRecord: () => void;
  onType: () => void;
  onPhoto: () => void;
  compact?: boolean;
};

export function DumpCaptureActions({ disabled, onRecord, onType, onPhoto, compact }: Props) {
  const { t } = useI18n();
  return (
    <div
      className={`bd-capture-actions${compact ? " bd-capture-actions--compact" : ""}`}
      role="group"
      aria-label={t("capture.groupAria")}
    >
      <button
        type="button"
        className="bd-capture-action bd-capture-action--primary"
        disabled={disabled}
        onClick={onRecord}
      >
        <Mic size={18} strokeWidth={2} aria-hidden="true" />
        {t("capture.record")}
      </button>
      <button type="button" className="bd-capture-action" disabled={disabled} onClick={onType}>
        <List size={16} strokeWidth={2} aria-hidden="true" />
        {t("capture.type")}
      </button>
      <button type="button" className="bd-capture-action" disabled={disabled} onClick={onPhoto}>
        <Camera size={16} strokeWidth={2} aria-hidden="true" />
        {t("capture.photo")}
      </button>
    </div>
  );
}
