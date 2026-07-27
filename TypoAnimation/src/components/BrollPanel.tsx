'use client';

import React, { useState } from 'react';
import type { Scene } from '@/types/project';
import type { StockVideoResult } from '@/lib/stockVideo';

export function BrollPanel({ scene, onChange }: { scene: Scene; onChange: (patch: Partial<Scene>) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockVideoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setStatus('Searching…');
    try {
      const res = await fetch('/api/broll/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json()) as { results?: StockVideoResult[] };
      setResults(data.results || []);
      setStatus(data.results?.length ? '' : 'No results — try a different search.');
    } catch {
      setStatus('Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const select = async (result: StockVideoResult) => {
    setBusy(true);
    setStatus('Downloading…');
    try {
      const res = await fetch('/api/broll/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      const data = (await res.json()) as { broll?: Scene['broll']; error?: string };
      if (data.broll) {
        onChange({ broll: data.broll });
        setResults([]);
        setStatus('');
      } else {
        setStatus(data.error || 'Failed to select.');
      }
    } catch {
      setStatus('Download failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/65">B-roll background</span>
        {scene.broll && (
          <button onClick={() => onChange({ broll: undefined })} className="text-xs text-white/45 hover:text-[#ff4757]">
            Remove
          </button>
        )}
      </div>

      {scene.broll ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#141414] p-1.5">
          {scene.broll.thumbnail && (
            // Thumbnails come from arbitrary provider CDNs (Pexels/Pixabay) — plain <img>
            // avoids having to allowlist every provider hostname in next/image's remotePatterns.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={scene.broll.thumbnail} alt="" className="h-12 w-20 rounded-lg object-cover" />
          )}
          <div className="text-xs text-white/65">
            <div className="font-medium capitalize text-white">{scene.broll.provider}</div>
            {scene.broll.credit && <div className="text-white/45">{scene.broll.credit}</div>}
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search stock video…"
            className="flex-1 rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-[#ff6b35]/50"
          />
          <button
            onClick={search}
            disabled={busy}
            className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Search
          </button>
        </div>
      )}

      {status && <p className="text-xs text-white/45">{status}</p>}

      {results.length > 0 && !scene.broll && (
        <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto">
          {results.map((r) => (
            <button
              key={`${r.provider}-${r.id}`}
              onClick={() => select(r)}
              disabled={busy}
              className="overflow-hidden rounded-lg border border-white/10 hover:border-[#ff6b35] disabled:opacity-50"
              title={r.credit}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumbnail} alt="" className="h-16 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
