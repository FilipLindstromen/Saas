'use client';

import React from 'react';
import type { Scene, SceneStyle } from '@/types/project';
import { COLOR_PRESETS } from '@/lib/colors';
import { FONT_PAIRING_OPTIONS } from '@/lib/fontPairings';
import { STYLE_OPTIONS } from './SceneStylePanel';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
      {label}
      {children}
    </label>
  );
}

// Applies one field at a time to every selected scene, the same "each control patches
// immediately on change" pattern SceneStylePanel uses for a single scene — there's no shared
// "current value" to show here since the selection can mix styles/settings, so every control
// starts neutral (unchecked / theme default / placeholder) and only touches the field the user
// actually interacts with.
export function BulkEditPanel({
  sceneIds,
  onApply,
}: {
  sceneIds: string[];
  onApply: (patch: Partial<Scene>) => void;
}) {
  const inputClass =
    'rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white outline-none placeholder:text-white/30 focus:border-[#ff6b35]/50';

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="text-[0.95rem] font-semibold text-white">{sceneIds.length} scenes selected</h2>
      <p className="text-xs text-white/45">Each field below applies to all {sceneIds.length} selected scenes as soon as you change it.</p>

      <Field label="Set style">
        <select
          className={inputClass}
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value) return;
            const style = e.target.value as SceneStyle;
            onApply({ style, ...(style === 'poster' ? { dark: true } : {}) });
          }}
        >
          <option value="" disabled className="bg-[#1f1f1f]">
            Leave unchanged
          </option>
          {STYLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1f1f1f]">
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#141414] px-3 py-2.5">
        <span className="text-xs font-semibold text-white/80">Background</span>
        <label className="flex items-center gap-2 text-xs font-medium text-white/65">
          <input type="checkbox" onChange={(e) => onApply({ dark: e.target.checked, ...(e.target.checked ? { secondaryBg: false } : {}) })} />
          Accent background
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-white/65">
          <input type="checkbox" onChange={(e) => onApply({ secondaryBg: e.target.checked })} />
          Alternate background
        </label>
      </div>

      <Field label="Set accent color override">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onApply({ accentColor: undefined })}
            className="rounded-xl border border-white/10 px-2 py-1 text-xs text-white/65 hover:border-white/20"
          >
            Theme default
          </button>
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.accent}
              type="button"
              title={p.label}
              onClick={() => onApply({ accentColor: p.accent })}
              style={{ background: p.accent }}
              className="h-7 w-7 rounded-lg border-2 border-transparent hover:border-white/40"
            />
          ))}
          <input
            type="color"
            defaultValue="#ec3013"
            onChange={(e) => onApply({ accentColor: e.target.value })}
            className="h-7 w-9 cursor-pointer rounded-lg border border-white/10"
            title="Custom color"
          />
        </div>
      </Field>

      <Field label="Set font pairing override">
        <select
          className={inputClass}
          defaultValue=""
          onChange={(e) => onApply({ font: e.target.value || undefined })}
        >
          <option value="" className="bg-[#1f1f1f]">
            Theme default
          </option>
          {FONT_PAIRING_OPTIONS.map((f) => (
            <option key={f.key} value={f.key} className="bg-[#1f1f1f]">
              {f.label}
            </option>
          ))}
        </select>
      </Field>

      <p className="border-t border-white/[0.06] pt-3 text-xs text-white/45">
        Per-scene copy, b-roll, and style-specific fields (number, rows, rotating words) still need
        editing one scene at a time — select just one scene to get to those.
      </p>
    </div>
  );
}
