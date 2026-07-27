'use client';

import React from 'react';
import type { Scene, SceneStyle } from '@/types/project';

const STYLE_LABELS: Record<SceneStyle, string> = {
  plain: 'Plain',
  poster: 'Poster',
  bignumber: 'Big number',
  compare: 'Compare',
  chips: 'Chips (outline)',
};

export function SceneList({
  scenes,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  onDuplicate,
  onAdd,
}: {
  scenes: Scene[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAdd: (style: SceneStyle) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Scenes ({scenes.length})
        </h2>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onAdd(e.target.value as SceneStyle);
            e.target.value = '';
          }}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="" disabled>
            + Add scene
          </option>
          {(Object.keys(STYLE_LABELS) as SceneStyle[]).map((s) => (
            <option key={s} value={s}>
              {STYLE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        {scenes.length === 0 && (
          <div className="rounded border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-400">
            No scenes yet — paste a script and generate, or add one manually.
          </div>
        )}
        {scenes.map((scene, i) => {
          const active = scene.id === selectedId;
          return (
            <div
              key={scene.id}
              onClick={() => onSelect(scene.id)}
              className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm ${
                active ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-neutral-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-neutral-900">{scene.name}</div>
                <div className="truncate text-xs text-neutral-500">
                  {STYLE_LABELS[scene.style]} · {scene.durationSec.toFixed(1)}s
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button
                  title="Move up"
                  onClick={() => onMove(scene.id, -1)}
                  disabled={i === 0}
                  className="rounded px-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  title="Move down"
                  onClick={() => onMove(scene.id, 1)}
                  disabled={i === scenes.length - 1}
                  className="rounded px-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  title="Duplicate"
                  onClick={() => onDuplicate(scene.id)}
                  className="rounded px-1 text-neutral-500 hover:bg-neutral-200"
                >
                  ⧉
                </button>
                <button
                  title="Remove"
                  onClick={() => onRemove(scene.id)}
                  className="rounded px-1 text-neutral-500 hover:bg-red-100 hover:text-red-600"
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
