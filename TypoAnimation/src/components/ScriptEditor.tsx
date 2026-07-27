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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Script</h2>
        <button
          onClick={onGenerate}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
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
        className="h-64 w-full resize-y rounded border border-neutral-300 bg-white p-3 font-mono text-sm leading-relaxed text-neutral-900 outline-none focus:border-neutral-500"
      />
      <p className="text-xs text-neutral-500">
        Re-generating replaces the current scene list. Fine-tune style, color and per-scene copy afterward in the panel on the right.
      </p>
    </div>
  );
}
