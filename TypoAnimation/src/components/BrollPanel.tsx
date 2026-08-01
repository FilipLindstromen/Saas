'use client';

import React, { useEffect, useState } from 'react';
import type { Scene } from '@/types/project';
import { STOCK_PROVIDER_OPTIONS, type StockMediaResult, type StockSearchScope } from '@/lib/stockMediaTypes';

export function BrollPanel({
  scene,
  onChange,
  panMode,
  onPanModeChange,
}: {
  scene: Scene;
  onChange: (patch: Partial<Scene>) => void;
  panMode?: boolean;
  onPanModeChange?: (on: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<StockSearchScope>('all');
  const [results, setResults] = useState<StockMediaResult[]>([]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  const closeOverlay = () => {
    setOverlayOpen(false);
    setResults([]);
  };

  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayOpen]);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setStatus('Searching…');
    setOverlayOpen(true);
    setLastSearchQuery(query.trim());
    try {
      const res = await fetch('/api/broll/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), provider }),
      });
      const data = (await res.json()) as { results?: StockMediaResult[] };
      const list = data.results || [];
      setResults(list);
      setStatus(list.length ? '' : 'No results — try a different search or source.');
    } catch {
      setResults([]);
      setStatus('Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const autoSelect = async () => {
    setBusy(true);
    setStatus('Finding b-roll from this scene’s text…');
    try {
      const res = await fetch('/api/broll/autoselect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: [scene] }),
      });
      const data = (await res.json()) as {
        updates?: { id: string; patch: Partial<Scene> }[];
        skipped?: { id: string; reason: string }[];
      };
      const broll = data.updates?.[0]?.patch.broll;
      if (broll) {
        onChange({ broll });
        setStatus('');
        closeOverlay();
      } else {
        setStatus(data.skipped?.[0]?.reason || 'No results found.');
      }
    } catch {
      setStatus('Auto-select failed.');
    } finally {
      setBusy(false);
    }
  };

  const select = async (result: StockMediaResult) => {
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
        closeOverlay();
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

  const providerLabel = STOCK_PROVIDER_OPTIONS.find((p) => p.id === provider)?.label ?? provider;

  const patchBroll = (p: Partial<NonNullable<Scene['broll']>>) => {
    if (!scene.broll) return;
    onChange({ broll: { ...scene.broll, ...p } });
  };

  return (
    <>
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
          <>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#141414] p-1.5">
              {scene.broll.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={scene.broll.thumbnail} alt="" className="h-12 w-20 rounded-lg object-cover" />
              )}
              <div className="text-xs text-white/65">
                <div className="font-medium capitalize text-white">
                  {scene.broll.provider} · {scene.broll.kind === 'image' ? 'photo' : 'video'}
                </div>
                {scene.broll.credit && <div className="text-white/45">{scene.broll.credit}</div>}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
              B-roll opacity ({Math.round((scene.broll.mediaOpacity ?? 1) * 100)}%)
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={scene.broll.mediaOpacity ?? 1}
                onChange={(e) => patchBroll({ mediaOpacity: Number(e.target.value) })}
                className="accent-[#ff6b35]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
              Dark overlay for text ({Math.round((scene.broll.opacity ?? 0.45) * 100)}%)
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.05}
                value={scene.broll.opacity ?? 0.45}
                onChange={(e) => patchBroll({ opacity: Number(e.target.value) })}
                className="accent-[#ff6b35]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
              Scale ({(scene.broll.scale ?? 1).toFixed(2)}×)
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.05}
                value={scene.broll.scale ?? 1}
                onChange={(e) => patchBroll({ scale: Number(e.target.value) })}
                className="accent-[#ff6b35]"
              />
            </label>

            {onPanModeChange && (
              <button
                type="button"
                onClick={() => onPanModeChange(!panMode)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  panMode
                    ? 'border-[#ff6b35] bg-[#ff6b35]/15 text-white'
                    : 'border-white/10 bg-[#141414] text-white/90 hover:bg-[#252525]'
                }`}
              >
                {panMode ? 'Done — panning in preview' : 'Position in preview (drag)'}
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={autoSelect}
              disabled={busy}
              className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:border-white/15 hover:bg-[#252525] disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Auto-select from this scene’s text'}
            </button>

            <div className="flex flex-wrap gap-1">
              {STOCK_PROVIDER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.hint}
                  disabled={busy}
                  onClick={() => setProvider(opt.id)}
                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                    provider === opt.id
                      ? 'border-[#ff6b35]/60 bg-[#ff6b35]/15 text-white'
                      : 'border-white/10 bg-[#141414] text-white/55 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Search stock video or photo…"
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
          </div>
        )}

        {status && !overlayOpen && <p className="text-xs text-white/45">{status}</p>}
      </div>

      {overlayOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="B-roll search results">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={closeOverlay}
          />
          <div className="relative z-[1] flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Choose b-roll</h3>
                <p className="mt-0.5 text-xs text-white/45">
                  {lastSearchQuery ? (
                    <>
                      “{lastSearchQuery}” · {providerLabel}
                    </>
                  ) : (
                    providerLabel
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeOverlay}
                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {busy && results.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">Searching…</p>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">
                  {status || 'No results — try another keyword or pick Pexels, Pixabay, or Unsplash above.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {results.map((r) => (
                    <button
                      key={`${r.provider}-${r.id}`}
                      type="button"
                      onClick={() => select(r)}
                      disabled={busy}
                      className="group relative overflow-hidden rounded-xl border border-white/10 text-left transition-colors hover:border-[#ff6b35] disabled:opacity-50"
                      title={r.credit}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.thumbnail} alt="" className="aspect-video w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-6">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/90">{r.provider}</span>
                        <span className="ml-1.5 text-[10px] text-white/60">{r.kind === 'image' ? 'photo' : 'video'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {status && !busy && results.length > 0 && (
              <div className="border-t border-white/10 px-4 py-2 text-xs text-white/45">{status}</div>
            )}
            {busy && results.length > 0 && (
              <div className="border-t border-white/10 px-4 py-2 text-xs text-white/45">Downloading…</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
