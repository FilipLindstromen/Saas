"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useI18n } from "@/lib/i18n";
import { type BrainDumpCenterHandle } from "@/components/CenterPanel";
import { DumpCaptureActions } from "@/components/DumpCaptureActions";
import type { ItemsViewType } from "@/components/ItemsViewArea";
import { getLastNewBatchIds, subscribeNewBatch } from "@/lib/newBatch";

function bottomBarTarget(
  viewType: ItemsViewType,
  todayViewActive: boolean,
  inboxActive: boolean
): "today" | "calendar" | "list" | "inbox" | null {
  if (todayViewActive) return "today";
  if (inboxActive) return "inbox";
  if (viewType === "calendar") return "calendar";
  if (viewType === "list") return "list";
  return null;
}

export type MobileBottomBarPillProps = {
  viewType: ItemsViewType;
  todayViewActive: boolean;
  inboxActive: boolean;
  dumpRecordingActive: boolean;
  centerPanelRef: RefObject<BrainDumpCenterHandle | null>;
  /** List view empty — show hint above the dump mic. */
  showDumpEmptyHint?: boolean;
  onTodayClick: () => void;
  onSelectCalendar: () => void;
  onSelectList: () => void;
  onSelectInbox: () => void;
};

type HighlightMetrics = {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
};

const HIGHLIGHT_INITIAL: HighlightMetrics = { left: 0, top: 0, width: 0, height: 0, visible: false };

export function MobileBottomBarPill({
  viewType,
  todayViewActive,
  inboxActive,
  dumpRecordingActive,
  centerPanelRef,
  showDumpEmptyHint = false,
  onTodayClick,
  onSelectCalendar,
  onSelectList,
  onSelectInbox,
}: MobileBottomBarPillProps) {
  const { t } = useI18n();
  const pillRef = useRef<HTMLElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLButtonElement>(null);
  const inboxRef = useRef<HTMLButtonElement>(null);
  const [highlight, setHighlight] = useState<HighlightMetrics>(HIGHLIGHT_INITIAL);
  const [newInboxCount, setNewInboxCount] = useState(0);

  useEffect(() => {
    const sync = () => setNewInboxCount(getLastNewBatchIds().size);
    sync();
    return subscribeNewBatch(sync);
  }, []);

  const measureHighlight = useCallback(() => {
    const nav = pillRef.current;
    const target = bottomBarTarget(viewType, todayViewActive, inboxActive);
    const btn =
      target === "today"
        ? todayRef.current
        : target === "calendar"
          ? calendarRef.current
          : target === "list"
            ? listRef.current
            : target === "inbox"
              ? inboxRef.current
              : null;
    if (!nav || !btn) {
      setHighlight(HIGHLIGHT_INITIAL);
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setHighlight({
      left: btnRect.left - navRect.left,
      top: btnRect.top - navRect.top,
      width: btnRect.width,
      height: btnRect.height,
      visible: true,
    });
  }, [inboxActive, todayViewActive, viewType]);

  useLayoutEffect(() => {
    measureHighlight();
    const nav = pillRef.current;
    const ro = new ResizeObserver(() => measureHighlight());
    if (nav) ro.observe(nav);
    window.addEventListener("resize", measureHighlight);
    window.addEventListener("orientationchange", measureHighlight);
    const id = window.requestAnimationFrame(() => measureHighlight());
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureHighlight);
      window.removeEventListener("orientationchange", measureHighlight);
      window.cancelAnimationFrame(id);
    };
  }, [measureHighlight]);

  return (
    <nav ref={pillRef} className="bd-bottom-bar-pill" aria-label={t("items.chooseView")}>
      <div
        className="bd-bottom-bar-pill-highlight"
        aria-hidden
        style={{
          left: highlight.left,
          top: highlight.top,
          width: highlight.width,
          height: highlight.height,
          opacity: highlight.visible ? 1 : 0,
        }}
      />
      <button
        ref={todayRef}
        type="button"
        className={`bd-bottom-bar-pill-item bd-bottom-bar-pill-item--today${todayViewActive ? " bd-bottom-bar-pill-item--active" : ""}`}
        onClick={onTodayClick}
        title={t("today.title")}
        aria-label={t("bottom.todayNav")}
        aria-pressed={todayViewActive}
      >
        <svg
          className="bd-bottom-bar-pill-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      </button>
      <button
        ref={calendarRef}
        type="button"
        className={`bd-bottom-bar-pill-item${viewType === "calendar" && !todayViewActive && !inboxActive ? " bd-bottom-bar-pill-item--active" : ""}`}
        onClick={onSelectCalendar}
        title={t("items.viewCalendar")}
        aria-label={t("items.viewCalendar")}
        aria-current={viewType === "calendar" && !todayViewActive && !inboxActive ? "page" : undefined}
      >
        <svg className="bd-bottom-bar-pill-icon bd-bottom-bar-pill-icon--calendar" width="24" height="24" viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <text
            x="12"
            y="17.5"
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill="currentColor"
            className="bd-bottom-bar-cal-day"
          >
            {new Date().getDate()}
          </text>
        </svg>
      </button>
      <div className="bd-bottom-bar-pill-mic-wrap">
        {showDumpEmptyHint ? (
          <div className="bd-bottom-bar-capture-stack">
            <p className="bd-dump-empty-hint-text bd-dump-empty-hint-text--mobile">{t("center.dumpEmptyHint")}</p>
            <DumpCaptureActions
              compact
              disabled={dumpRecordingActive}
              onRecord={() => centerPanelRef.current?.toggleDumpRecording()}
              onType={() => centerPanelRef.current?.openTypedDumpSheet()}
              onPhoto={() => centerPanelRef.current?.openPhotoCaptureMenu()}
            />
          </div>
        ) : null}
        <button
          type="button"
          className={`bd-bottom-dump-mic${dumpRecordingActive ? " bd-bottom-dump-mic--recording" : ""}`}
          onClick={() => centerPanelRef.current?.toggleDumpRecording()}
          title={dumpRecordingActive ? t("center.stopOrganize") : t("center.recordNewDump")}
          aria-label={dumpRecordingActive ? t("center.stopOrganize") : t("center.recordNewDump")}
        >
          {dumpRecordingActive ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>
      </div>
      <button
        ref={listRef}
        type="button"
        className={`bd-bottom-bar-pill-item bd-bottom-bar-pill-item--tasks${viewType === "list" && !todayViewActive && !inboxActive ? " bd-bottom-bar-pill-item--active" : ""}`}
        onClick={onSelectList}
        title={t("items.viewList")}
        aria-label={t("items.viewList")}
        aria-current={viewType === "list" && !todayViewActive && !inboxActive ? "page" : undefined}
      >
        <svg className="bd-bottom-bar-pill-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M8.5 12.5 11 15l4.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        ref={inboxRef}
        type="button"
        className={`bd-bottom-bar-pill-item bd-bottom-bar-pill-item--inbox${inboxActive ? " bd-bottom-bar-pill-item--active" : ""}`}
        onClick={onSelectInbox}
        title={t("bottom.inboxNav")}
        aria-label={t("bottom.inboxNav")}
        aria-current={inboxActive ? "page" : undefined}
      >
        <span className="bd-bottom-bar-pill-icon-wrap">
          <svg className="bd-bottom-bar-pill-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          {newInboxCount > 0 ? (
            <span className="bd-bottom-bar-inbox-badge" aria-hidden>
              {newInboxCount > 9 ? "9+" : newInboxCount}
            </span>
          ) : null}
        </span>
      </button>
    </nav>
  );
}
