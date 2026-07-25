"use client";

import { useEffect, useRef, useState } from "react";
import { Dice5, X, Play } from "lucide-react";
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

  const domainLabel =
    task.domain === "work" ? "Work" : task.domain === "personal" ? "Personal" : task.domain;
  const categoryLabel = task.category
    ? task.category.charAt(0).toUpperCase() + task.category.slice(1).replace(/_/g, " ")
    : null;

  // ── Counting / GO phase ───────────────────────────────────────────
  if (phase === "counting" || phase === "go") {
    const isGo = phase === "go";
    return (
      <>
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
            50%       { opacity: 0.88; }
          }
          @keyframes _bd_lucky_task_hint {
            from { opacity: 0; transform: translateX(-50%) translateY(8px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
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
            background: isGo
              ? "linear-gradient(165deg, #ff8f6b 0%, #e85d2d 45%, #d64d22 100%)"
              : "linear-gradient(160deg, #0c0c10 0%, #111116 100%)",
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
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: isGo ? "#fff" : "#fff",
              fontSize: isGo ? "clamp(5rem, 22vmin, 16rem)" : "clamp(6rem, 28vmin, 20rem)",
              animation: isGo
                ? "_bd_lucky_go_pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both"
                : "_bd_lucky_pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
              textShadow: isGo
                ? "0 4px 32px rgba(0,0,0,0.2)"
                : "0 0 80px rgba(255,120,60,0.4), 0 4px 32px rgba(0,0,0,0.6)",
            }}
          >
            {isGo ? "GO!" : count}
          </span>

          {!isGo && (
            <p
              style={{
                position: "absolute",
                bottom: "clamp(2rem, 6vh, 4rem)",
                left: "50%",
                animation: "_bd_lucky_task_hint 0.4s 0.1s cubic-bezier(0.22,1,0.36,1) both",
                width: "min(480px, 88vw)",
                textAlign: "center",
                fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)",
                color: "rgba(255,255,255,0.5)",
                fontWeight: 500,
                lineHeight: 1.45,
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
    <>
      <style>{`
        @keyframes _bd_lucky_modal_in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes _bd_lucky_backdrop_in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-lucky-title"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: "var(--bd-z-modal)" as never,
          background: "var(--bd-overlay-modal)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          animation: "_bd_lucky_backdrop_in 0.25s ease both",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--card-radius)",
            maxWidth: "min(520px, 100%)",
            width: "100%",
            boxShadow: "var(--shadow-lg), 0 0 0 1px var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "_bd_lucky_modal_in 0.35s cubic-bezier(0.22,1,0.36,1) both",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header: gradient banner with dice icon */}
          <div
            style={{
              background: "linear-gradient(165deg, #ff8f6b 0%, #e85d2d 50%, #d64d22 100%)",
              padding: "1.25rem 1.5rem 1rem",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle texture circles */}
            <div style={{
              position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: 0.12,
            }}>
              <div style={{ position: "absolute", top: "-30%", right: "-10%", width: 180, height: 180, borderRadius: "50%", background: "#fff" }} />
              <div style={{ position: "absolute", bottom: "-40%", left: "5%", width: 120, height: 120, borderRadius: "50%", background: "#fff" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", position: "relative" }}>
              {/* Dice icon */}
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Dice5 size={22} color="#fff" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
                  Your lucky task
                </p>
                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#fff" }}>
                  Let&apos;s get it done!
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: "relative",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, padding: 0, flexShrink: 0,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "50%",
                color: "#fff",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
            >
              <X size={16} strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" />
            </button>
          </div>

          {/* Meta badges */}
          <div style={{ padding: "0.85rem 1.5rem 0.4rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center",
              fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--text-tertiary)",
              background: "var(--bg-tertiary)", border: "1px solid var(--border-default)",
              borderRadius: "6px", padding: "0.2rem 0.55rem",
            }}>
              {domainLabel}{categoryLabel ? ` · ${categoryLabel}` : ""}
            </span>
            {task.project?.name && (
              <span style={{
                display: "inline-flex", alignItems: "center",
                fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase", color: "var(--text-tertiary)",
                background: "var(--bg-tertiary)", border: "1px solid var(--border-default)",
                borderRadius: "6px", padding: "0.2rem 0.55rem",
              }}>
                {task.project.name}
              </span>
            )}
          </div>

          {/* Task title */}
          <div style={{ padding: "0.35rem 1.5rem 1.35rem" }}>
            <p
              id="bd-lucky-title"
              style={{
                margin: 0,
                fontSize: "clamp(1.2rem, 4vw, 1.75rem)",
                fontWeight: 700,
                lineHeight: 1.25,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              {task.title}
            </p>
            {task.content && task.content !== task.title && (
              <p style={{
                margin: "0.6rem 0 0",
                fontSize: "0.9375rem",
                color: "var(--text-secondary)",
                lineHeight: 1.55,
              }}>
                {task.content}
              </p>
            )}
          </div>

          {/* Footer */}
          <div style={{ height: 1, background: "var(--border-subtle)" }} />
          <div style={{
            padding: "0.875rem 1.5rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", lineHeight: 1.4 }}>
              Ready to tackle this?
            </span>

            <button
              type="button"
              onClick={startCountdown}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontWeight: 700,
                fontSize: "0.9375rem",
                padding: "0.625rem 1.5rem",
                background: "linear-gradient(165deg, #ff8f6b 0%, #e85d2d 45%, #d64d22 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "999px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(232,93,45,0.35)",
                transition: "filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.08)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(232,93,45,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(232,93,45,0.35)";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.97)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "";
              }}
            >
              <Play size={15} strokeWidth={2.5} aria-hidden="true" />
              Start
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
