'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CompareRow, Scene, SceneLine, SceneStyle } from '@/types/project';
import { COLOR_PRESETS } from '@/lib/colors';
import { FONT_PAIRING_OPTIONS } from '@/lib/fontPairings';
import { splitSceneLinesPreservingHighlights } from '@/lib/inlineHighlight';
import { BrollPanel } from './BrollPanel';

export const STYLE_OPTIONS: { value: SceneStyle; label: string }[] = [
  { value: 'plain', label: 'Plain — word-by-word text' },
  { value: 'poster', label: 'Poster — full-bleed statement' },
  { value: 'bignumber', label: 'Big number — animated counter' },
  { value: 'compare', label: 'Compare — animated bars' },
  { value: 'chips', label: 'Chips — outlined pill list' },
  { value: 'falling', label: 'Falling lines — sequential drop-in reveal' },
  { value: 'videotext', label: 'Video text — headline filled with b-roll' },
  { value: 'rotate', label: 'Rotating word — cycling slot' },
  { value: 'typewriter', label: 'Typewriter — character-by-character' },
  { value: 'mosaic', label: 'Word mosaic — mixed-size word collage' },
  { value: 'statement', label: 'Statement — auto-sized to fill the frame' },
  { value: 'badge', label: 'Badge / CTA — headline over a bordered bar' },
  { value: 'uniform', label: 'Uniform lines — every line sized to match width' },
];

function defaultRotatingWordsFromLines(lines: SceneLine[]): string[] {
  const last = lines[lines.length - 1]?.text.trim();
  if (!last) return ['word'];
  const parts = last.split(/\s+/).filter(Boolean);
  return parts.length ? parts : ['word'];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
      {label}
      {children}
    </label>
  );
}

// One line of the textarea per SceneLine, round-tripping the same "> " / ">> " accent-line
// convention the script editor already uses (">" = accent/chip, ">>" = accent/marker) — so
// marking a line as an emphasis line doesn't need a separate per-line control, just a prefix.
function linesToText(lines: SceneLine[]): string {
  return lines.map((l) => (l.accent ? `${l.emphasis === 'marker' ? '>>' : '>'} ${l.text}` : l.text)).join('\n');
}

function parseLinesText(text: string): SceneLine[] {
  return splitSceneLinesPreservingHighlights(text).map((raw) => {
    if (raw.startsWith('>> ')) return { text: raw.slice(3), accent: true, emphasis: 'marker' as const };
    if (raw.startsWith('> ')) return { text: raw.slice(2), accent: true };
    return { text: raw };
  });
}

interface HighlightMenuState {
  x: number;
  y: number;
  selStart: number;
  selEnd: number;
}

// The Lines textarea plus its right-click "set inline background" menu — pulled out on its
// own since the menu needs its own open/closed state and a ref to read the live selection
// range at the moment of the right-click (selectionStart/End survive the textarea losing
// focus to the menu, so reading them in the menu's own click handler is safe).
function LinesEditor({ scene, patch }: { scene: Scene; patch: (p: Partial<Scene>) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<HighlightMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (ta.selectionStart === ta.selectionEnd) return; // no selection — let the native menu through
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, selStart: ta.selectionStart, selEnd: ta.selectionEnd });
  };

  const applyToSelection = (transform: (selected: string) => string) => {
    if (!menu) return;
    const value = linesToText(scene.lines);
    const { selStart, selEnd } = menu;
    const next = value.slice(0, selStart) + transform(value.slice(selStart, selEnd)) + value.slice(selEnd);
    patch({ lines: parseLinesText(next) });
    setMenu(null);
  };

  const inputClass =
    'rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white outline-none placeholder:text-white/30 focus:border-[#ff6b35]/50';

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={6}
        className={`w-full resize-y font-mono text-sm leading-relaxed ${inputClass}`}
        value={linesToText(scene.lines)}
        onChange={(e) => patch({ lines: parseLinesText(e.target.value) })}
        onContextMenu={handleContextMenu}
        placeholder={scene.style === 'chips' ? 'Fast\nReliable\nSimple' : 'A normal line\n> An accent / chip line\n>> An accent / marker line'}
      />
      {menu && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 50 }}
          className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1f1f1f] py-1 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        >
          <button
            onClick={() => applyToSelection((s) => `[[${s}]]`)}
            className="px-3 py-1.5 text-left text-white/90 hover:bg-[#ff6b35]/20"
          >
            Set inline background
          </button>
          <button
            onClick={() => applyToSelection((s) => s.replace(/\[\[|\]\]/g, ''))}
            className="px-3 py-1.5 text-left text-white/90 hover:bg-[#ff6b35]/20"
          >
            Remove inline background
          </button>
        </div>
      )}
    </div>
  );
}

export function SceneStylePanel({
  scene,
  onChange,
  hideBroll,
  hasVideo,
  brollPanMode,
  onBrollPanModeChange,
}: {
  scene: Scene | null;
  onChange: (id: string, patch: Partial<Scene>) => void;
  hideBroll?: boolean;
  /** whether the project has a webcam/voiceover video uploaded, worth showing the per-scene override for */
  hasVideo?: boolean;
  brollPanMode?: boolean;
  onBrollPanModeChange?: (on: boolean) => void;
}) {
  if (!scene) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-white/45">
        Select a scene to edit its style, copy and colors.
      </div>
    );
  }

  const patch = (p: Partial<Scene>) => onChange(scene.id, p);

  const rotatingWords = scene.rotatingWords || [];
  const updateWord = (i: number, v: string) => {
    const next = rotatingWords.slice();
    next[i] = v;
    patch({ rotatingWords: next });
  };
  const addWord = () => patch({ rotatingWords: [...rotatingWords, 'word'] });
  const removeWord = (i: number) => patch({ rotatingWords: rotatingWords.filter((_, idx) => idx !== i) });

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
        <select
          className={inputClass}
          value={scene.style}
          onChange={(e) => {
            const style = e.target.value as SceneStyle;
            if (style === 'rotate' && !(scene.rotatingWords || []).some((w) => w.trim())) {
              patch({ style, rotatingWords: defaultRotatingWordsFromLines(scene.lines) });
              return;
            }
            patch({ style });
          }}
        >
          {STYLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1f1f1f]">
              {o.label}
            </option>
          ))}
        </select>
      </Field>

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
        <Field label={scene.style === 'chips' ? 'Chip labels (one per line)' : 'Lines (one per line)'}>
          <LinesEditor scene={scene} patch={patch} />
          {scene.style === 'chips' && (
            <label className="mt-2 flex items-center gap-1.5 text-xs font-medium text-white/65">
              <input
                type="checkbox"
                checked={!!scene.chipsVertical}
                onChange={(e) => patch({ chipsVertical: e.target.checked })}
              />
              Stack chips vertically (one per row)
            </label>
          )}
          {scene.style !== 'chips' && (
            <span className="font-normal normal-case text-white/35">
              Prefix a line with <code>&gt;</code> for a chip accent, <code>&gt;&gt;</code> for a marker accent. Right-click a text selection to set its inline background.
            </span>
          )}
        </Field>
      )}

      <Field label="Background">
        <div className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#141414] px-3 py-2.5">
          <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-white/80">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!scene.dark}
              onChange={(e) => patch({ dark: e.target.checked, ...(e.target.checked ? { secondaryBg: false } : {}) })}
            />
            <span>
              <span className="block text-white">Accent background</span>
              <span className="font-normal text-white/45">Full-frame accent color with light text</span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-2 text-xs font-medium ${scene.dark ? 'text-white/35' : 'text-white/80'}`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!scene.secondaryBg}
              disabled={!!scene.dark}
              onChange={(e) => patch({ secondaryBg: e.target.checked })}
            />
            <span>
              <span className="block text-inherit">Alternate background</span>
              <span className="font-normal text-white/45">Uses the secondary colors from Theme settings</span>
            </span>
          </label>
        </div>
      </Field>

      {hasVideo && (
        <Field label="Video override (this scene only)">
          <select className={inputClass} value={scene.videoMode || ''} onChange={(e) => patch({ videoMode: (e.target.value || undefined) as Scene['videoMode'] })}>
            <option value="" className="bg-[#1f1f1f]">
              Use project default
            </option>
            <option value="pip" className="bg-[#1f1f1f]">Picture-in-picture (round)</option>
            <option value="background" className="bg-[#1f1f1f]">Full-bleed background</option>
            <option value="hidden" className="bg-[#1f1f1f]">Hidden (audio only)</option>
          </select>
        </Field>
      )}

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

      {!hideBroll && (
        <BrollPanel
          scene={scene}
          onChange={patch}
          panMode={brollPanMode}
          onPanModeChange={onBrollPanModeChange}
        />
      )}

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

      {scene.style === 'videotext' && !scene.broll && (
        <p className="text-xs text-white/45">Pick a b-roll clip below to fill the headline with footage — without one it falls back to plain ink-colored text.</p>
      )}

      {scene.style === 'rotate' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/45">
            Lines above stay fixed. The words below cycle in the rotating slot — one entry per word or short phrase.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-white/65">Fill from line:</span>
            {scene.lines.map((ln, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  patch({
                    rotatingWords: ln.text
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean),
                  })
                }
                className="rounded-lg border border-white/10 bg-[#141414] px-2 py-1 text-xs text-white/80 hover:border-[#ff6b35]/40"
              >
                Line {i + 1}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/65">Rotating words</span>
            <button onClick={addWord} className="text-xs font-medium text-white/90 hover:text-[#ff6b35]">
              + Add word
            </button>
          </div>
          {rotatingWords.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className={`flex-1 text-sm ${inputClass}`} value={w} onChange={(e) => updateWord(i, e.target.value)} />
              <button onClick={() => removeWord(i)} className="rounded-lg px-1 text-white/45 hover:text-[#ff4757]">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
