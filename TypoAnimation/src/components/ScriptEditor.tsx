'use client';

import React from 'react';

export function ScriptEditor({
  value,
  onChange,
  onGenerate,
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[0.95rem] font-semibold text-white">Script</h2>
        <button
          onClick={onGenerate}
          className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
        >
          Generate scenes
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={
          'Paste your script here.\n\nEither plain paragraphs (one scene per blank-line-separated block), or the structured format:\n\n### Scene name\n^ optional kicker\nA normal line\n> An accent / chip-highlighted line'
        }
        className="h-64 w-full resize-y rounded-xl border border-white/10 bg-[#141414] p-3 font-mono text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-[#ff6b35]/50"
      />
      <p className="text-xs text-white/45">
        Re-generating replaces the current scene list. Fine-tune style, color and per-scene copy afterward in the panel on the right.
      </p>
    </div>
  );
}
