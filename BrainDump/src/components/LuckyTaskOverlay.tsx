"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewItem } from "./ItemsViewArea";

interface LuckyTaskOverlayProps {
  isOpen: boolean;
  task: ViewItem | null;
  onClose: () => void;
}

type Phase = "task" | "counting" | "go";

const COUNTDOWN_START = 5;

export function LuckyTaskOverlay({ isOpen, task, onClose }: LuckyTaskOverlayProps) {
  const [phase, setPhase] = useState<Phase>("task");
  const [count, setCount] = useState(COUNTDOWN_START);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset to task phase whenever the overlay opens with a new task.
  useEffect(() => {
    if (isOpen) {
      setPhase("task");
      setCount(COUNTDOWN_START);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen]);

  function startCountdown() {
    setPhase("counting");
    setCount(COUNTDOWN_START);

    let current = COUNTDOWN_START;
    intervalRef.current = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCount(current);
      } else {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setPhase("go");
        setTimeout(onClose, 1100);
      }
    }, 900);
  }

  if (!isOpen || !task) return null;

  const domainLabel = task.domain === "work" ? "Work" : task.domain === "personal" ? "Personal" : task.domain;
  const categoryLabel = task.category
    ? task.category.charAt(0).toUpperCase() + task.category.slice(1).replace(/_/g, " ")
    : null;

  // ── Counting phase ───────────────────────────────────────────────
  if (phase === "counting" || phase === "go") {
    const isGo = phase === "go";
    return (
      <>
        {/* Inject keyframe inline — self-contained, no globals.css required */}
        <style>{`
          @keyframes _bd_lucky_pop {
            0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.55); }
            18%  { opacity: 1; transform: translate(-50%, -50%) scale(0.95); }
            30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
            42%  { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
            100% { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
          }
          @keyframes _bd_lucky_go_pop {
            0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            40%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
            60%  { opacity: 1; transform: translate(-50%, -50%) scale(0.97); }
            100% { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
          }
          @keyframes _bd_lucky_bg_pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.85; }
          }
        `}</style>

        <div
          role="dialog"
          aria-modal="true"
          aria-label={isGo ? "Go!" : `Countdown: ${count}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: "var(--bd-z-modal)" as never,
            background: isGo ? "var(--accent)" : "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: isGo ? "_bd_lucky_bg_pulse 0.6s ease-in-out" : undefined,
          }}
        >
          <span
            key={isGo ? "go" : count}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              userSelect: "none",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: isGo ? "#000" : "#fff",
              fontSize: isGo ? "clamp(5rem, 22vmin, 16rem)" : "clamp(6rem, 28vmin, 20rem)",
              animation: isGo
                ? "_bd_lucky_go_pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both"
                : "_bd_lucky_pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          >
            {isGo ? "GO!" : count}
          </span>

          {/* Subtle task title reminder during countdown */}
          {!isGo && (
            <p
              style={{
                position: "absolute",
                bottom: "clamp(2rem, 6vh, 4rem)",
                left: "50%",
                transform: "translateX(-50%)",
                width: "min(480px, 88vw)",
                textAlign: "center",
                fontSize: "clamp(0.9rem, 2.5vw, 1.15rem)",
                color: "rgba(255,255,255,0.45)",
                fontWeight: 500,
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {task.title}
            </p>
          )}
        </div>
      </>
    );
  }

  // ── Task display phase ───────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-lucky-title"
      className="bd-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bd-modal-panel"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--card-radius)",
          maxWidth: "min(520px, 100%)",
          width: "100%",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.75rem 0.875rem 0" }}>
          <button
            type="button"
            className="bd-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: "0.2rem 0.5rem", border: "none", background: "none", fontSize: "1.25rem", color: "var(--text-secondary)" }}
          >
            ×
          </button>
        </div>

        {/* Badge row */}
        <div style={{ padding: "0 1.5rem 0.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em",
            textTransform: "uppercase", color: "var(--text-secondary)",
            background: "var(--bg-tertiary)", border: "1px solid var(--border-default)",
            borderRadius: "4px", padding: "0.2rem 0.55rem",
          }}>
            {domainLabel}
            {categoryLabel ? ` · ${categoryLabel}` : ""}
          </span>
          {task.project?.name && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "var(--text-secondary)",
              background: "var(--bg-tertiary)", border: "1px solid var(--border-default)",
              borderRadius: "4px", padding: "0.2rem 0.55rem",
            }}>
              {task.project.name}
            </span>
          )}
        </div>

        {/* Task title */}
        <div style={{ padding: "0.25rem 1.5rem 1.25rem" }}>
          <p
            id="bd-lucky-title"
            style={{
              margin: 0,
              fontSize: "clamp(1.35rem, 4vw, 1.9rem)",
              fontWeight: 700,
              lineHeight: 1.25,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {task.title}
          </p>
          {task.content && task.content !== task.title && (
            <p style={{
              margin: "0.65rem 0 0",
              fontSize: "0.9375rem",
              color: "var(--text-secondary)",
              lineHeight: 1.55,
            }}>
              {task.content}
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 1.5rem" }} />

        {/* Footer: dice label + Start button */}
        <div style={{
          padding: "1rem 1.5rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
            Ready to tackle this?<br />
            <span style={{ color: "var(--text-secondary)", opacity: 0.65 }}>Press Start when you are.</span>
          </span>

          <button
            type="button"
            className="bd-btn"
            onClick={startCountdown}
            style={{
              flexShrink: 0,
              fontWeight: 700,
              fontSize: "1rem",
              padding: "0.75rem 2rem",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--button-radius)",
              letterSpacing: "0.02em",
            }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
