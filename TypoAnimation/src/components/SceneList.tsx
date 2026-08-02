'use client';

import React, { useEffect, useState } from 'react';
import type { ProjectTheme, Scene, SceneStyle } from '@/types/project';
import { resolveSceneTheme } from '@/remotion/shared/theme';

const STYLE_LABELS: Record<SceneStyle, string> = {
  plain: 'Plain',
  poster: 'Poster',
  bignumber: 'Big number',
  compare: 'Compare',
  chips: 'Chips (outline)',
  falling: 'Falling lines',
  videotext: 'Video text',
  rotate: 'Rotating word',
  typewriter: 'Typewriter',
  mosaic: 'Word mosaic',
  statement: 'Statement (auto-fit)',
  badge: 'Badge / CTA',
  uniform: 'Uniform lines',
};

// One glyph per style, shown in the thumbnail slot in place of a real rendered preview.
const STYLE_GLYPHS: Record<SceneStyle, string> = {
  plain: 'Aa',
  poster: '❖',
  bignumber: '42',
  compare: '▤',
  chips: '◫',
  falling: '↓',
  videotext: '▶',
  rotate: '⇅',
  typewriter: '_',
  mosaic: '▦',
  statement: '⬛',
  badge: '▭',
  uniform: '≡',
};

// A small preview swatch using the scene's actual resolved colors (respecting its own
// dark/accent overrides, same as the real render), its b-roll thumbnail as a background image
// when it has one, and a snippet of its actual copy — so the list reads as a rough storyboard
// instead of a wall of identical gray boxes with a style glyph.
function SceneThumb({ theme, scene }: { theme: ProjectTheme; scene: Scene }) {
  const resolved = resolveSceneTheme(theme, scene);
  const snippet =
    scene.style === 'bignumber' && scene.number != null
      ? `${scene.number}${scene.numberSuffix || ''}`
      : scene.kicker || scene.lines[0]?.text || '';
  const bgStyle: React.CSSProperties = scene.broll?.thumbnail
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,${scene.broll.opacity ?? 0.45}), rgba(0,0,0,${scene.broll.opacity ?? 0.45})), url(${scene.broll.thumbnail})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: resolved.bg };

  return (
    <div className="relative flex h-[45px] w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 px-1" style={bgStyle}>
      <span
        className="line-clamp-2 text-center text-[9px] font-bold leading-[1.1]"
        style={{ color: scene.broll?.thumbnail ? '#fff' : resolved.ink, fontFamily: resolved.fontHeading }}
      >
        {snippet || STYLE_GLYPHS[scene.style]}
      </span>
      <span
        className="absolute bottom-0 right-0.5 text-[8px] opacity-70"
        style={{ color: scene.broll?.thumbnail ? '#fff' : resolved.ink }}
      >
        {STYLE_GLYPHS[scene.style]}
      </span>
    </div>
  );
}

function DuplicateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function SceneList({
  scenes,
  theme,
  selectedId,
  multiSelectedIds,
  onSelect,
  onReorder,
  onRemove,
  onDuplicate,
  onAdd,
}: {
  scenes: Scene[];
  theme: ProjectTheme;
  selectedId: string | null;
  /** every id currently part of the multi-select (includes selectedId when non-empty) */
  multiSelectedIds: string[];
  onSelect: (id: string, opts: { shift?: boolean; toggle?: boolean }) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAdd: (style: SceneStyle) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (document.fullscreenElement) return;

      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'radio') return;
      if (el instanceof HTMLElement && el.isContentEditable) return;

      if (!selectedId || scenes.length === 0) return;

      const idx = scenes.findIndex((s) => s.id === selectedId);
      if (idx === -1) return;
      const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= scenes.length) return;

      e.preventDefault();
      const nextId = scenes[nextIdx].id;
      onSelect(nextId, {});
      requestAnimationFrame(() => {
        document.querySelector(`[data-scene-list-id="${nextId}"]`)?.scrollIntoView({ block: 'nearest' });
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelect, scenes, selectedId]);

  const handleDrop = (targetId: string) => {
    if (draggedId && draggedId !== targetId) {
      const fromIndex = scenes.findIndex((s) => s.id === draggedId);
      const toIndex = scenes.findIndex((s) => s.id === targetId);
      if (fromIndex !== -1 && toIndex !== -1) onReorder(fromIndex, toIndex);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a1a] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] p-4">
        <h2 className="text-[0.95rem] font-semibold text-white">
          Scenes ({scenes.length}){multiSelectedIds.length > 1 && ` · ${multiSelectedIds.length} selected`}
        </h2>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onAdd(e.target.value as SceneStyle);
            e.target.value = '';
          }}
          className="rounded-xl border border-white/10 bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        >
          <option value="" disabled className="bg-[#1f1f1f] text-white">
            + Add scene
          </option>
          {(Object.keys(STYLE_LABELS) as SceneStyle[]).map((s) => (
            <option key={s} value={s} className="bg-[#1f1f1f] text-white">
              {STYLE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {scenes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-white/45">
            No scenes yet — paste a script and generate, or add one manually.
          </div>
        )}
        {scenes.map((scene, i) => {
          const primary = scene.id === selectedId;
          const inMultiSelect = multiSelectedIds.includes(scene.id);
          const dragging = draggedId === scene.id;
          const dragOver = dragOverId === scene.id && draggedId !== scene.id;
          return (
            <div
              key={scene.id}
              data-scene-list-id={scene.id}
              className={`flex items-center gap-3 ${dragging ? 'opacity-50' : ''}`}
              draggable
              onDragStart={() => setDraggedId(scene.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(scene.id);
              }}
              onDragLeave={() => setDragOverId((id) => (id === scene.id ? null : id))}
              onDrop={() => handleDrop(scene.id)}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
            >
              <span className="w-6 shrink-0 text-right text-[0.85rem] font-semibold text-white/65">{i + 1}</span>

              <div
                onClick={(e) => onSelect(scene.id, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey })}
                className={`relative min-w-0 flex-1 cursor-move overflow-hidden rounded-2xl border p-[0.875rem] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-200 ${
                  primary
                    ? 'border-[#ff6b35] bg-[#1f1f1f] shadow-[0_0_0_2px_rgba(255,107,53,0.2),0_4px_16px_rgba(0,0,0,0.5)]'
                    : inMultiSelect
                      ? 'border-[#ff6b35]/50 bg-[#212121]'
                      : dragOver
                        ? 'border-[#ff6b35] bg-[#252525]'
                        : 'border-white/[0.06] bg-[#1f1f1f] hover:-translate-y-0.5 hover:border-white/10 hover:bg-[#252525] hover:shadow-[0_4px_16px_rgba(0,0,0,0.5)]'
                }`}
              >
                <span
                  className={`absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[#ff6b35] to-[#ff4757] transition-transform duration-200 ${
                    primary || inMultiSelect ? 'scale-y-100' : 'scale-y-0'
                  }`}
                />
                <div className="flex items-center gap-3">
                  <SceneThumb theme={theme} scene={scene} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{scene.name}</div>
                    <div className="truncate text-xs text-white/45">
                      {STYLE_LABELS[scene.style]} · {scene.durationSec.toFixed(1)}s
                      {scene.broll && ' · b-roll'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  title="Duplicate"
                  onClick={() => onDuplicate(scene.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-white/65 hover:border-white/15 hover:text-white"
                >
                  <DuplicateIcon />
                </button>
                <button
                  title="Remove"
                  onClick={() => onRemove(scene.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-white/65 hover:border-[#ff4757]/50 hover:bg-[#ff4757]/10 hover:text-[#ff4757]"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
