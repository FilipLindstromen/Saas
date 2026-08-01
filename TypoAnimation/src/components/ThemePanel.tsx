'use client';

import React from 'react';
import type { AspectRatio, Project, ProjectTheme } from '@/types/project';
import { COLOR_PRESETS } from '@/lib/colors';
import { FONT_PAIRING_OPTIONS } from '@/lib/fontPairings';

const ASPECT_RATIO_OPTIONS: { value: AspectRatio; sub: string }[] = [
  { value: '1:1', sub: '1080×1080' },
  { value: '16:9', sub: '1920×1080' },
  { value: '9:16', sub: '1080×1920' },
];

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
      <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
        Project name
        <input
          className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white outline-none focus:border-[#ff6b35]/50"
          value={project.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
        Chrome label (top-left eyebrow)
        <input
          className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white outline-none focus:border-[#ff6b35]/50"
          placeholder={project.name}
          value={project.label || ''}
          onChange={(e) => onChange({ label: e.target.value || undefined })}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/65">Color palette</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => {
            const active = theme.accent === p.accent && theme.bg === p.bg && theme.ink === p.ink;
            return (
              <button
                key={p.label}
                type="button"
                title={p.label}
                onClick={() => patchTheme({ accent: p.accent, bg: p.bg, ink: p.ink })}
                className={`flex h-10 w-14 overflow-hidden rounded-lg border-2 ${active ? 'border-[#ff6b35]' : 'border-transparent'}`}
              >
                <span className="flex-1" style={{ background: p.bg }} />
                <span className="w-3" style={{ background: p.accent }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
          Accent
          <input type="color" value={theme.accent} onChange={(e) => patchTheme({ accent: e.target.value })} className="h-8 w-14 cursor-pointer rounded-lg border border-white/10" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
          Background
          <input type="color" value={theme.bg} onChange={(e) => patchTheme({ bg: e.target.value })} className="h-8 w-14 cursor-pointer rounded-lg border border-white/10" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
          Ink
          <input type="color" value={theme.ink} onChange={(e) => patchTheme({ ink: e.target.value })} className="h-8 w-14 cursor-pointer rounded-lg border border-white/10" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
        Default font pairing
        <select
          className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white"
          value={theme.fontPairing}
          onChange={(e) => patchTheme({ fontPairing: e.target.value })}
        >
          {FONT_PAIRING_OPTIONS.map((f) => (
            <option key={f.key} value={f.key} className="bg-[#1f1f1f]">
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
        <span className="flex items-center justify-between">
          Font size
          <span className="text-white/45">{Math.round((theme.fontScale ?? 1) * 100)}%</span>
        </span>
        <input
          type="range"
          min={0.7}
          max={1.5}
          step={0.05}
          value={theme.fontScale ?? 1}
          onChange={(e) => patchTheme({ fontScale: Number(e.target.value) })}
          className="accent-[#ff6b35]"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/65">Work area / export size</span>
        <div className="flex gap-1.5">
          {ASPECT_RATIO_OPTIONS.map((o) => {
            const active = (project.aspectRatio || '1:1') === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ aspectRatio: o.value })}
                className={`flex-1 rounded-xl border px-2 py-1.5 text-center text-xs font-semibold transition-colors ${
                  active
                    ? 'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ff4757] text-white'
                    : 'border-white/10 text-white/65 hover:border-white/20'
                }`}
              >
                {o.value}
                <div className="text-[0.65rem] font-normal opacity-75">{o.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
        Scene transition
        <select
          className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white"
          value={theme.transition || 'cut'}
          onChange={(e) => patchTheme({ transition: e.target.value as ProjectTheme['transition'] })}
        >
          <option value="cut" className="bg-[#1f1f1f]">Cut (default)</option>
          <option value="fade" className="bg-[#1f1f1f]">Fade</option>
          <option value="slide" className="bg-[#1f1f1f]">Slide</option>
          <option value="wipe" className="bg-[#1f1f1f]">Wipe</option>
        </select>
      </label>

      <div className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-3">
        <span className="text-xs font-medium text-white/65">Voiceover reference (chrome overlays)</span>
        <label className="flex items-center gap-1.5 text-xs text-white/90">
          <input type="checkbox" checked={!!project.showCaptions} onChange={(e) => onChange({ showCaptions: e.target.checked })} />
          Show captions
        </label>
        <label className="flex items-center gap-1.5 text-xs text-white/90">
          <input type="checkbox" checked={!!project.showTimecode} onChange={(e) => onChange({ showTimecode: e.target.checked })} />
          Show timecode
        </label>
      </div>
    </div>
  );
}
