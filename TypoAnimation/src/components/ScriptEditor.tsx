'use client';

import React from 'react';

export function ScriptEditor({
  value,
  onChange,
  onGenerate,
  onUpdateCopy,
  showUpdateCopy,
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  /** re-parses the text and patches each existing scene's name/kicker/lines by position,
   * leaving style/duration/colors/b-roll/etc alone — unlike onGenerate, which replaces the
   * whole scene list with brand-new scenes. */
  onUpdateCopy?: () => void;
  /** whether the text has diverged from what the current scenes would serialize back to */
  showUpdateCopy?: boolean;
}) {
  return (
    <div className="flex h-full flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[0.95rem] font-semibold text-white">Script</h2>
        <div className="flex gap-2">
          {showUpdateCopy && onUpdateCopy && (
            <button
              onClick={onUpdateCopy}
              className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] hover:border-white/15"
            >
              Update copy only
            </button>
          )}
          <button
            onClick={onGenerate}
            className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
          >
            Generate scenes
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={
          'Paste your script here.\n\nEither plain paragraphs (one scene per blank-line-separated block), or the structured format:\n\n### Scene name\n^ optional kicker\nA normal line\n> An accent / chip-highlighted line'
        }
        className="min-h-0 w-full flex-1 resize-none rounded-xl border border-white/10 bg-[#141414] p-3 font-mono text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-[#ff6b35]/50"
      />
      <p className="text-xs text-white/45">
        {showUpdateCopy
          ? '"Update copy only" keeps every scene\'s style, duration, colors and b-roll — just swaps the text. "Generate scenes" replaces the whole list with fresh defaults instead.'
          : 'Re-generating replaces the current scene list. Fine-tune style, color and per-scene copy afterward in the panel on the right.'}
      </p>
    </div>
  );
}
