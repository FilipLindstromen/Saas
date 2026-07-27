'use client';

import React from 'react';
import type { CompareRow, Scene, SceneLine, SceneStyle } from '@/types/project';
import { COLOR_PRESETS } from '@/lib/colors';
import { FONT_PAIRING_OPTIONS } from '@/lib/fontPairings';
import { BrollPanel } from './BrollPanel';

const STYLE_OPTIONS: { value: SceneStyle; label: string }[] = [
  { value: 'plain', label: 'Plain — word-by-word text' },
  { value: 'poster', label: 'Poster — full-bleed statement' },
  { value: 'bignumber', label: 'Big number — animated counter' },
  { value: 'compare', label: 'Compare — animated bars' },
  { value: 'chips', label: 'Chips — outlined pill list' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
      {label}
      {children}
    </label>
  );
}

export function SceneStylePanel({
  scene,
  onChange,
}: {
  scene: Scene | null;
  onChange: (id: string, patch: Partial<Scene>) => void;
}) {
  if (!scene) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-white/45">
        Select a scene to edit its style, copy and colors.
      </div>
    );
  }

  const patch = (p: Partial<Scene>) => onChange(scene.id, p);

  const updateLine = (i: number, p: Partial<SceneLine>) => {
    const lines = scene.lines.slice();
    lines[i] = { ...lines[i], ...p };
    patch({ lines });
  };
  const addLine = () => patch({ lines: [...scene.lines, { text: 'New line' }] });
  const removeLine = (i: number) => patch({ lines: scene.lines.filter((_, idx) => idx !== i) });

  const rows = scene.compareRows || [];
  const updateRow = (i: number, p: Partial<CompareRow>) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...p };
    patch({ compareRows: next });
  };
  const addRow = () => patch({ compareRows: [...rows, { label: 'Label', sub: 'sub', value: 0.5 }] });
  const removeRow = (i: number) => patch({ compareRows: rows.filter((_, idx) => idx !== i) });

  const inputClass =
    'rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white outline-none placeholder:text-white/30 focus:border-[#ff6b35]/50';

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="text-[0.95rem] font-semibold text-white">Scene</h2>

      <Field label="Name">
        <input className={inputClass} value={scene.name} onChange={(e) => patch({ name: e.target.value })} />
      </Field>

      <Field label="Style">
        <select className={inputClass} value={scene.style} onChange={(e) => patch({ style: e.target.value as SceneStyle })}>
          {STYLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1f1f1f]">
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-3">
        <Field label="Duration (sec)">
          <input
            type="number"
            step={0.1}
            min={0.5}
            max={30}
            className={`w-24 ${inputClass}`}
            value={scene.durationSec}
            onChange={(e) => patch({ durationSec: Number(e.target.value) || 0.5 })}
          />
        </Field>
        <label className="mt-5 flex items-center gap-1.5 text-xs font-medium text-white/65">
          <input type="checkbox" checked={!!scene.dark} onChange={(e) => patch({ dark: e.target.checked })} />
          Dark / full-bleed field
        </label>
      </div>

      <Field label="Accent color override">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => patch({ accentColor: undefined })}
            className={`rounded-xl border px-2 py-1 text-xs ${
              !scene.accentColor
                ? 'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ff4757] text-white'
                : 'border-white/10 text-white/65'
            }`}
          >
            Theme default
          </button>
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.accent}
              type="button"
              title={p.label}
              onClick={() => patch({ accentColor: p.accent })}
              style={{ background: p.accent }}
              className={`h-7 w-7 rounded-lg border-2 ${scene.accentColor === p.accent ? 'border-[#ff6b35]' : 'border-transparent'}`}
            />
          ))}
          <input
            type="color"
            value={scene.accentColor || '#ec3013'}
            onChange={(e) => patch({ accentColor: e.target.value })}
            className="h-7 w-9 cursor-pointer rounded-lg border border-white/10"
            title="Custom color"
          />
        </div>
      </Field>

      <Field label="Font pairing override">
        <select className={inputClass} value={scene.font || ''} onChange={(e) => patch({ font: e.target.value || undefined })}>
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

      <Field label="Kicker (optional small caps line)">
        <input className={inputClass} value={scene.kicker || ''} onChange={(e) => patch({ kicker: e.target.value || undefined })} />
      </Field>

      <BrollPanel scene={scene} onChange={patch} />

      {scene.style === 'bignumber' && (
        <div className="flex gap-3">
          <Field label="Number">
            <input
              type="number"
              className={`w-24 ${inputClass}`}
              value={scene.number ?? 90}
              onChange={(e) => patch({ number: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Suffix (e.g. X)">
            <input
              className={`w-24 ${inputClass}`}
              value={scene.numberSuffix || ''}
              onChange={(e) => patch({ numberSuffix: e.target.value || undefined })}
            />
          </Field>
        </div>
      )}

      {scene.style === 'compare' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/65">Comparison rows</span>
            <button onClick={addRow} className="text-xs font-medium text-white/90 hover:text-[#ff6b35]">
              + Add row
            </button>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#141414] p-1.5">
              <input
                className="w-24 rounded-lg border border-white/10 bg-[#1a1a1a] px-1.5 py-1 text-xs text-white outline-none"
                placeholder="Label"
                value={r.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={r.value}
                onChange={(e) => updateRow(i, { value: Number(e.target.value) })}
                className="flex-1 accent-[#ff6b35]"
              />
              <input
                className="w-16 rounded-lg border border-white/10 bg-[#1a1a1a] px-1.5 py-1 text-xs text-white outline-none"
                placeholder="sub"
                value={r.sub}
                onChange={(e) => updateRow(i, { sub: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-white/65">
                <input type="checkbox" checked={!!r.accent} onChange={(e) => updateRow(i, { accent: e.target.checked })} />
                accent
              </label>
              <button onClick={() => removeRow(i)} className="rounded-lg px-1 text-white/45 hover:text-[#ff4757]">
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/65">{scene.style === 'chips' ? 'Chip labels' : 'Lines'}</span>
            <button onClick={addLine} className="text-xs font-medium text-white/90 hover:text-[#ff6b35]">
              + Add line
            </button>
          </div>
          {scene.lines.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                className={`flex-1 text-sm ${inputClass}`}
                value={l.text}
                onChange={(e) => updateLine(i, { text: e.target.value })}
              />
              {scene.style !== 'chips' && (
                <label className="flex items-center gap-1 text-xs text-white/65">
                  <input type="checkbox" checked={!!l.accent} onChange={(e) => updateLine(i, { accent: e.target.checked })} />
                  chip
                </label>
              )}
              <button onClick={() => removeLine(i)} className="rounded-lg px-1 text-white/45 hover:text-[#ff4757]">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
