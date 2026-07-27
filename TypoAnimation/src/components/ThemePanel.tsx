'use client';

import React from 'react';
import type { Project, ProjectTheme } from '@/types/project';
import { COLOR_PRESETS } from '@/lib/colors';
import { FONT_PAIRING_OPTIONS } from '@/lib/fontPairings';

export function ThemePanel({
  project,
  onChange,
}: {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}) {
  const theme = project.theme;
  const patchTheme = (p: Partial<ProjectTheme>) => onChange({ theme: { ...theme, ...p } });

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Theme</h2>

      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Project name
        <input
          className="rounded border border-neutral-300 px-2 py-1 text-neutral-900"
          value={project.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Chrome label (top-left eyebrow)
        <input
          className="rounded border border-neutral-300 px-2 py-1 text-neutral-900"
          placeholder={project.name}
          value={project.label || ''}
          onChange={(e) => onChange({ label: e.target.value || undefined })}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-500">Color palette</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => {
            const active = theme.accent === p.accent && theme.bg === p.bg && theme.ink === p.ink;
            return (
              <button
                key={p.label}
                type="button"
                title={p.label}
                onClick={() => patchTheme({ accent: p.accent, bg: p.bg, ink: p.ink })}
                className={`flex h-10 w-14 overflow-hidden rounded border-2 ${active ? 'border-neutral-900' : 'border-transparent'}`}
              >
                <span className="flex-1" style={{ background: p.bg }} />
                <span className="w-3" style={{ background: p.accent }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Accent
          <input type="color" value={theme.accent} onChange={(e) => patchTheme({ accent: e.target.value })} className="h-8 w-14 cursor-pointer rounded border border-neutral-300" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Background
          <input type="color" value={theme.bg} onChange={(e) => patchTheme({ bg: e.target.value })} className="h-8 w-14 cursor-pointer rounded border border-neutral-300" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Ink
          <input type="color" value={theme.ink} onChange={(e) => patchTheme({ ink: e.target.value })} className="h-8 w-14 cursor-pointer rounded border border-neutral-300" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Default font pairing
        <select
          className="rounded border border-neutral-300 px-2 py-1 text-neutral-900"
          value={theme.fontPairing}
          onChange={(e) => patchTheme({ fontPairing: e.target.value })}
        >
          {FONT_PAIRING_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5 border-t border-neutral-200 pt-3">
        <span className="text-xs font-medium text-neutral-500">Voiceover reference (chrome overlays)</span>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700">
          <input type="checkbox" checked={!!project.showCaptions} onChange={(e) => onChange({ showCaptions: e.target.checked })} />
          Show captions
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700">
          <input type="checkbox" checked={!!project.showTimecode} onChange={(e) => onChange({ showTimecode: e.target.checked })} />
          Show timecode
        </label>
      </div>
    </div>
  );
}
