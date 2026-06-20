"use client";

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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
        {t("capture.record")}
      </button>
      <button type="button" className="bd-capture-action" disabled={disabled} onClick={onType}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 9h4M7 13h8" />
        </svg>
        {t("capture.type")}
      </button>
      <button type="button" className="bd-capture-action" disabled={disabled} onClick={onPhoto}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {t("capture.photo")}
      </button>
    </div>
  );
}
