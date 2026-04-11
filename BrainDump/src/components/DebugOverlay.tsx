"use client";

import { useEffect, useState } from "react";
import { loadDebugSnapshot, type DebugOrganizeSnapshot } from "@/lib/form-storage";

interface DebugOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebugOverlay({ isOpen, onClose }: DebugOverlayProps) {
  const [snapshot, setSnapshot] = useState<DebugOrganizeSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<"raw" | "organized">("raw");
  const [copied, setCopied] = useState<"raw" | "organized" | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSnapshot(loadDebugSnapshot());
    setActiveTab("raw");
  }, [isOpen]);

  const copyText = (tab: "raw" | "organized") => {
    const text =
      tab === "raw"
        ? (snapshot?.rawTranscript ?? "")
        : JSON.stringify(snapshot?.organizedItems ?? [], null, 2);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(tab);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  if (!isOpen) return null;

  const formattedDate = snapshot?.organizedAt
    ? new Date(snapshot.organizedAt).toLocaleString()
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-debug-title"
      className="bd-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bd-modal-panel"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--card-radius)",
          maxWidth: "min(680px, 100%)",
          width: "100%",
          maxHeight: "min(90dvh, calc(100dvh - 2rem))",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            flexShrink: 0,
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            <circle cx="18" cy="8" r="4" fill="var(--accent)" stroke="none" />
          </svg>
          <h2
            id="bd-debug-title"
            style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, flex: 1 }}
          >
            Debug — Last Organize
          </h2>
          {formattedDate && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {formattedDate}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="bd-btn"
            style={{ padding: "0.25rem 0.5rem", marginLeft: "0.25rem" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          {(["raw", "organized"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "0.625rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {tab === "raw" ? "Raw Transcript" : "Organized Result"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            position: "relative",
          }}
        >
          {!snapshot ? (
            <p
              style={{
                padding: "2rem 1.25rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                textAlign: "center",
              }}
            >
              No organize run recorded yet. Transcribe and organize a dump first.
            </p>
          ) : (
            <>
              <button
                type="button"
                className="bd-btn"
                onClick={() => copyText(activeTab)}
                style={{
                  position: "sticky",
                  top: "0.75rem",
                  float: "right",
                  margin: "0.75rem 0.75rem 0 0",
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.625rem",
                  zIndex: 1,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {copied === activeTab ? "Copied!" : "Copy"}
              </button>

              {activeTab === "raw" ? (
                <pre
                  style={{
                    margin: 0,
                    padding: "1rem 1.25rem",
                    fontSize: "0.8125rem",
                    lineHeight: 1.6,
                    color: "var(--text-primary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "inherit",
                  }}
                >
                  {snapshot.rawTranscript || <em style={{ color: "var(--text-secondary)" }}>(empty)</em>}
                </pre>
              ) : (
                <pre
                  style={{
                    margin: 0,
                    padding: "1rem 1.25rem",
                    fontSize: "0.75rem",
                    lineHeight: 1.55,
                    color: "var(--text-primary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily:
                      "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'Cascadia Code', monospace",
                  }}
                >
                  {JSON.stringify(snapshot.organizedItems, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button type="button" className="bd-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
