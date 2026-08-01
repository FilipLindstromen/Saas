'use client';

import React, { useRef } from 'react';
import type { BrollAsset } from '@/types/project';
import { clamp01 } from '@/remotion/shared/brollFraming';

export function BrollFramingOverlay({
  broll,
  active,
  onPatch,
}: {
  broll: BrollAsset;
  active: boolean;
  onPatch: (patch: Partial<BrollAsset>) => void;
}) {
  const drag = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null);

  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing"
      style={{ background: 'transparent' }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = {
          px: e.clientX,
          py: e.clientY,
          fx: broll.focusX ?? 0.5,
          fy: broll.focusY ?? 0.5,
        };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const dx = (e.clientX - drag.current.px) / rect.width;
        const dy = (e.clientY - drag.current.py) / rect.height;
        onPatch({
          focusX: clamp01(drag.current.fx + dx),
          focusY: clamp01(drag.current.fy + dy),
        });
      }}
      onPointerUp={(e) => {
        drag.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-medium text-white/90">
        Drag to pan b-roll
      </div>
    </div>
  );
}
