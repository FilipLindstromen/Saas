"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Sun, Calendar, Square, Mic, CheckSquare, Inbox } from "lucide-react";
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
  /** No entries anywhere in the account yet — hide the view-switcher buttons and show only the record button. */
  hasAnyEntries: boolean;
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
  hasAnyEntries,
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
    <nav
      ref={pillRef}
      className={`bd-bottom-bar-pill${hasAnyEntries ? "" : " bd-bottom-bar-pill--mic-only"}`}
      aria-label={t("items.chooseView")}
    >
      {hasAnyEntries ? (
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
      ) : null}
      {hasAnyEntries ? (
        <button
          ref={todayRef}
          type="button"
          className={`bd-bottom-bar-pill-item bd-bottom-bar-pill-item--today${todayViewActive ? " bd-bottom-bar-pill-item--active" : ""}`}
          onClick={onTodayClick}
          title={t("today.title")}
          aria-label={t("bottom.todayNav")}
          aria-pressed={todayViewActive}
        >
          <Sun
            className="bd-bottom-bar-pill-icon"
            size={24}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      ) : null}
      {hasAnyEntries ? (
        <button
          ref={calendarRef}
          type="button"
          className={`bd-bottom-bar-pill-item${viewType === "calendar" && !todayViewActive && !inboxActive ? " bd-bottom-bar-pill-item--active" : ""}`}
          onClick={onSelectCalendar}
          title={t("items.viewCalendar")}
          aria-label={t("items.viewCalendar")}
          aria-current={viewType === "calendar" && !todayViewActive && !inboxActive ? "page" : undefined}
        >
          <span
            className="bd-bottom-bar-pill-icon bd-bottom-bar-pill-icon--calendar"
            style={{ position: "relative", display: "inline-flex" }}
            aria-hidden="true"
          >
            <Calendar size={24} strokeWidth={2} />
            <span
              className="bd-bottom-bar-cal-day"
              style={{
                position: "absolute",
                left: "50%",
                top: "66%",
                transform: "translate(-50%, -50%)",
                fontSize: "9px",
                fontWeight: 600,
                lineHeight: 1,
                color: "currentColor",
                pointerEvents: "none",
              }}
            >
              {new Date().getDate()}
            </span>
          </span>
        </button>
      ) : null}
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
            <Square size={28} fill="currentColor" stroke="none" aria-hidden="true" />
          ) : (
            <Mic size={28} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>
      {hasAnyEntries ? (
        <button
          ref={listRef}
          type="button"
          className={`bd-bottom-bar-pill-item bd-bottom-bar-pill-item--tasks${viewType === "list" && !todayViewActive && !inboxActive ? " bd-bottom-bar-pill-item--active" : ""}`}
          onClick={onSelectList}
          title={t("items.viewList")}
          aria-label={t("items.viewList")}
          aria-current={viewType === "list" && !todayViewActive && !inboxActive ? "page" : undefined}
        >
          <CheckSquare className="bd-bottom-bar-pill-icon" size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
      {hasAnyEntries ? (
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
            <Inbox className="bd-bottom-bar-pill-icon" size={24} strokeWidth={2} aria-hidden="true" />
            {newInboxCount > 0 ? (
              <span className="bd-bottom-bar-inbox-badge" aria-hidden>
                {newInboxCount > 9 ? "9+" : newInboxCount}
              </span>
            ) : null}
          </span>
        </button>
      ) : null}
    </nav>
  );
}
