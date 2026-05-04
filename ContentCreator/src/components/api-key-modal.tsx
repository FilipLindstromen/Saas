"use client";

import { useState } from "react";
import { useAppState } from "@/lib/app-state";

export function ApiKeyModal() {
  const { data, setData } = useAppState();
  const [openai, setOpenai] = useState(data.apiKeys.openai ?? "");
  const [anthropic, setAnthropic] = useState(data.apiKeys.anthropic ?? "");
  const [perplexity, setPerplexity] = useState(data.apiKeys.perplexity ?? "");
  const open = !Boolean(data.apiKeys.openai && data.apiKeys.anthropic);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">Set API keys to use the app</h2>
        <p className="mt-1 text-sm text-zinc-400">Keys are shared via SaaS local storage (`saasApiKeys`). Add at least OpenAI + Anthropic.</p>
        <div className="mt-4 space-y-3">
          <input className="w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-sm" placeholder="OpenAI API key" value={openai} onChange={(e) => setOpenai(e.target.value)} />
          <input className="w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-sm" placeholder="Anthropic API key" value={anthropic} onChange={(e) => setAnthropic(e.target.value)} />
          <input className="w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-sm" placeholder="Perplexity API key (optional)" value={perplexity} onChange={(e) => setPerplexity(e.target.value)} />
        </div>
        <button
          className="mt-4 rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          disabled={!openai || !anthropic}
          onClick={() => setData((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, openai, anthropic, perplexity } }))}
        >
          Save keys
        </button>
      </div>
    </div>
  );
}
