"use client";

import type { CSSProperties } from "react";

type Props = {
  organizeEn: string;
  organizeSv: string;
  coachPrompt: string;
  aiDefaultsLoaded: boolean;
  aiUsingCustomEn: boolean;
  aiUsingCustomSv: boolean;
  aiUsingCustomCoach: boolean;
  aiSaving: boolean;
  aiMessage: string | null;
  onOrganizeEnChange: (value: string) => void;
  onOrganizeSvChange: (value: string) => void;
  onCoachPromptChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
};

const textareaStyle: CSSProperties = {
  width: "100%",
  resize: "vertical",
  fontFamily: "ui-monospace, monospace",
  fontSize: "0.78rem",
  lineHeight: 1.45,
  padding: "0.65rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
};

export function AdminAiInstructionsSection({
  organizeEn,
  organizeSv,
  coachPrompt,
  aiDefaultsLoaded,
  aiUsingCustomEn,
  aiUsingCustomSv,
  aiUsingCustomCoach,
  aiSaving,
  aiMessage,
  onOrganizeEnChange,
  onOrganizeSvChange,
  onCoachPromptChange,
  onSave,
  onReset,
}: Props) {
  return (
    <section
      style={{
        padding: "1rem 1.1rem",
        borderRadius: "var(--card-radius)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>AI instructions (global)</h2>
      <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: "0 0 1rem", maxWidth: 720 }}>
        Edit the system prompts used when organizing brain dumps and when users chat with the coach. Changes apply to{" "}
        <strong>all users</strong> immediately. Project lists and workspace context are still appended at runtime.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            Organize — English{" "}
            <span style={{ fontWeight: 400, color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
              {aiUsingCustomEn ? "(custom override active)" : "(built-in default)"}
            </span>
          </span>
          <textarea
            value={organizeEn}
            onChange={(e) => onOrganizeEnChange(e.target.value)}
            rows={12}
            spellCheck={false}
            style={{ ...textareaStyle, minHeight: 220 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            Organize — Swedish{" "}
            <span style={{ fontWeight: 400, color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
              {aiUsingCustomSv ? "(custom override active)" : "(built-in default)"}
            </span>
          </span>
          <textarea
            value={organizeSv}
            onChange={(e) => onOrganizeSvChange(e.target.value)}
            rows={12}
            spellCheck={false}
            style={{ ...textareaStyle, minHeight: 220 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            Coach chat base prompt{" "}
            <span style={{ fontWeight: 400, color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
              {aiUsingCustomCoach ? "(custom override active)" : "(built-in default)"} — use{" "}
              <code style={{ fontSize: "0.95em" }}>{`{{REPLY_LANG}}`}</code> for the language rule
            </span>
          </span>
          <textarea
            value={coachPrompt}
            onChange={(e) => onCoachPromptChange(e.target.value)}
            rows={8}
            spellCheck={false}
            style={{ ...textareaStyle, minHeight: 160 }}
          />
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "1rem", alignItems: "center" }}>
        <button
          type="button"
          className="bd-btn bd-btn-primary"
          disabled={aiSaving || !aiDefaultsLoaded}
          onClick={onSave}
        >
          {aiSaving ? "Saving…" : "Save instructions"}
        </button>
        <button type="button" className="bd-btn" disabled={aiSaving || !aiDefaultsLoaded} onClick={onReset}>
          Reset to built-in defaults
        </button>
        {aiMessage ? <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{aiMessage}</span> : null}
      </div>
    </section>
  );
}
