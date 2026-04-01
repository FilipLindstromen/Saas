"use client";

import { useEffect, useMemo, useState } from "react";

export type DumpListeningFaceVariant = "sheet" | "overlay";

interface DumpListeningFaceProps {
  variant?: DumpListeningFaceVariant;
  className?: string;
}

/**
 * Minimal hand-drawn-style face: two vertical eyes + smile.
 * Blink uses one shared delay + duration so both eyes close together; mouth has a slow “listening” pulse.
 */
export function DumpListeningFace({ variant = "sheet", className = "" }: DumpListeningFaceProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  const blinkPhaseDelay = useMemo(() => Math.random() * 1.4, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const animate = !reduceMotion;
  const rootClass = [
    "bd-dump-face",
    variant === "overlay" ? "bd-dump-face--overlay" : "bd-dump-face--sheet",
    animate ? "bd-dump-face--animate" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} aria-hidden>
      <svg
        className="bd-dump-face-svg"
        viewBox="0 0 120 76"
        width={120}
        height={76}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Eyes: short vertical strokes */}
        <g
          className="bd-dump-face-eye bd-dump-face-eye--l"
          style={animate ? { animationDelay: `${blinkPhaseDelay}s` } : undefined}
        >
          <line x1={38} y1={18} x2={38} y2={32} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <g
          className="bd-dump-face-eye bd-dump-face-eye--r"
          style={animate ? { animationDelay: `${blinkPhaseDelay}s` } : undefined}
        >
          <line x1={82} y1={18} x2={82} y2={32} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </g>
        {/* Smile */}
        <g className="bd-dump-face-mouth-wrap">
          <path
            d="M 30 46 Q 60 58 90 46"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}
