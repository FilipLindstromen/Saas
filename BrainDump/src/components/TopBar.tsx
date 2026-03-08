"use client";

import { ThemeToggle } from "./ThemeToggle";

type Mode = "inbox" | "work" | "personal" | "all";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onOpenSettings?: () => void;
}

const MODE_TITLE: Record<Mode, string> = {
  work: "Work",
  personal: "Personal",
  inbox: "Inbox",
  all: "All",
};

export function TopBar({ mode, onModeChange, onOpenSettings }: TopBarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.75rem 1rem",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <h1 style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
        BrainDump
      </h1>
      <span style={{ marginLeft: "1rem", fontSize: "0.875rem", color: "var(--text-tertiary)" }}>
        {MODE_TITLE[mode]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <ThemeToggle />
        <button type="button" className="bd-btn" onClick={onOpenSettings} title="API key and settings" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}>
          Settings
        </button>
      </div>
    </header>
  );
}
