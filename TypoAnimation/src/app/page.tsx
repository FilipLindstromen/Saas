'use client';

import React, { useEffect, useState } from 'react';
import { createEmptyProject, createScene, type Project, type Scene, type SceneStyle } from '@/types/project';
import { parseScript, pickSceneStyle, extractBigNumber, estimateDuration } from '@/lib/parseScript';
import { PreviewPlayer } from '@/components/PreviewPlayer';
import { ScriptEditor } from '@/components/ScriptEditor';
import { SceneList } from '@/components/SceneList';
import { SceneStylePanel } from '@/components/SceneStylePanel';
import { BulkEditPanel } from '@/components/BulkEditPanel';
import { ThemePanel } from '@/components/ThemePanel';
import { SettingsOverlay } from '@/components/SettingsOverlay';
import { VideoSyncPanel } from '@/components/VideoSyncPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { listLocalProjects, loadLocalProject, saveLocalProject } from '@/lib/localProjectStore';
import type { ProjectSummary } from '@/lib/projectStore';

// Set at build time by scripts/static-build.mjs for the GitHub Pages build: no server exists
// there, so upload/transcribe/render/b-roll (which all need one) are hidden, and project
// save/load falls back to the browser's own localStorage instead of the /api/projects route.
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

const SAMPLE_SCRIPT = `### Hook
^ Anxiety — Part One
How to stop the
> 3 things creating
your anxiety — within minutes.

### Chest
Your chest tightens.

### Breath
Your breathing speeds up.

### Memo
> But your body didn't get the memo.
`;

export default function Home() {
  const [project, setProject] = useState<Project>(() => createEmptyProject());
  const [scriptText, setScriptText] = useState(SAMPLE_SCRIPT);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  // Every id currently in the multi-select; selectedSceneId is the "primary" one (drives the
  // playhead + is last-clicked, for shift-range-select) and stays included whenever this is
  // non-empty. Plain clicks collapse this back down to a single id.
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState<string>('');
  const [brollStatus, setBrollStatus] = useState<string>('');
  const [brollBusy, setBrollBusy] = useState(false);
  const [mode, setMode] = useState<'plan' | 'edit'>('plan');
  const [themeOverlayOpen, setThemeOverlayOpen] = useState(false);

  const refreshProjectList = () => {
    if (IS_STATIC) {
      setSavedProjects(listLocalProjects());
      return;
    }
    fetch('/api/projects')
      .then((r) => r.json())
      .then(setSavedProjects)
      .catch(() => {});
  };

  useEffect(() => {
    refreshProjectList();
  }, []);

  const patchProject = (patch: Partial<Project>) =>
    setProject((p) => ({ ...p, ...patch, updatedAt: new Date().toISOString() }));

  // Sets a single "primary" selection, collapsing any multi-select — used everywhere scenes
  // get selected programmatically (generate, add, load, duplicate), as opposed to the
  // click-driven handleSelectScene below which also handles shift/ctrl multi-select.
  const selectOne = (id: string | null) => {
    setSelectedSceneId(id);
    setMultiSelectedIds(id ? [id] : []);
  };

  const handleSelectScene = (id: string, opts: { shift?: boolean; toggle?: boolean }) => {
    if (opts.toggle) {
      setMultiSelectedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        setSelectedSceneId(next.length ? id : null);
        return next;
      });
      return;
    }
    if (opts.shift && selectedSceneId) {
      const ids = project.scenes.map((s) => s.id);
      const a = ids.indexOf(selectedSceneId);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = ids.slice(lo, hi + 1);
        setMultiSelectedIds((prev) => Array.from(new Set([...prev, ...range])));
        setSelectedSceneId(id);
        return;
      }
    }
    selectOne(id);
  };

  // Applies one field at a time to every scene in the multi-select (BulkEditPanel calls this
  // once per control the user touches). Skips the content-driven duration re-fit patchScene
  // does — bulk edits are about style/settings, not text, so a scene's duration shouldn't move
  // just because its style changed.
  const handleBulkPatch = (patch: Partial<Scene>) =>
    setProject((p) => ({
      ...p,
      scenes: p.scenes.map((s) => (multiSelectedIds.includes(s.id) ? { ...s, ...patch } : s)),
      updatedAt: new Date().toISOString(),
    }));

  const patchScene = (id: string, patch: Partial<Scene>) =>
    setProject((p) => ({
      ...p,
      scenes: p.scenes.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        // Content edits re-fit the duration to the new word count, unless this scene is
        // voiceover-synced (wordTimings set) — that duration must stay locked to the audio
        // track regardless of text edits. An explicit edit to durationSec itself (the manual
        // "Duration (sec)" field) always wins and isn't immediately overwritten.
        const contentChanged = ('lines' in patch || 'kicker' in patch) && !('durationSec' in patch);
        if (contentChanged && !next.wordTimings) {
          next.durationSec = estimateDuration(next.kicker, next.lines);
        }
        return next;
      }),
      updatedAt: new Date().toISOString(),
    }));

  // Re-runs the content classifier against every existing scene's current lines/kicker,
  // overwriting style (and, for scenes that read as a stat callout, number/numberSuffix) —
  // an explicit bulk action, so unlike the live per-edit duration fit above it's fine to
  // clobber styles the user picked manually, same as "Auto-select b-roll for all scenes" does.
  const handleAutoSetStyles = () =>
    setProject((p) => ({
      ...p,
      scenes: p.scenes.map((s) => {
        const style = pickSceneStyle(s.kicker, s.lines);
        const big = style === 'bignumber' ? extractBigNumber(s.lines) : null;
        const lines = big ? big.rest : s.lines;
        return {
          ...s,
          style,
          lines,
          number: big ? big.number : s.style === 'bignumber' ? s.number : undefined,
          numberSuffix: big ? big.suffix : s.style === 'bignumber' ? s.numberSuffix : undefined,
          dark: style === 'poster' ? true : s.dark,
          durationSec: s.wordTimings ? s.durationSec : estimateDuration(s.kicker, lines),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));

  const handleGenerate = () => {
    const scenes = parseScript(scriptText);
    setProject((p) => ({ ...p, scenes, updatedAt: new Date().toISOString() }));
    selectOne(scenes[0]?.id ?? null);
    setMode('edit');
  };

  const handleReorder = (fromIndex: number, toIndex: number) =>
    setProject((p) => {
      const scenes = p.scenes.slice();
      const [moved] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, moved);
      return { ...p, scenes, updatedAt: new Date().toISOString() };
    });

  const handleRemove = (id: string) => {
    setProject((p) => ({ ...p, scenes: p.scenes.filter((s) => s.id !== id), updatedAt: new Date().toISOString() }));
    setMultiSelectedIds((prev) => prev.filter((x) => x !== id));
    setSelectedSceneId((prev) => (prev === id ? null : prev));
  };

  const handleDuplicate = (id: string) =>
    setProject((p) => {
      const idx = p.scenes.findIndex((s) => s.id === id);
      if (idx < 0) return p;
      const copy: Scene = { ...p.scenes[idx], id: crypto.randomUUID(), name: `${p.scenes[idx].name} copy` };
      const scenes = p.scenes.slice();
      scenes.splice(idx + 1, 0, copy);
      return { ...p, scenes, updatedAt: new Date().toISOString() };
    });

  const handleAdd = (style: SceneStyle) =>
    setProject((p) => {
      const scene = createScene({
        style,
        name: `Scene ${p.scenes.length + 1}`,
        lines: [{ text: style === 'rotate' ? 'We are' : 'New line' }],
        dark: style === 'poster',
        rotatingWords: style === 'rotate' ? ['fast', 'reliable', 'simple'] : undefined,
        compareRows:
          style === 'compare'
            ? [
                { label: 'Option A', sub: 'slow', value: 0.8 },
                { label: 'Option B', sub: 'fast', value: 0.2, accent: true },
              ]
            : undefined,
        number: style === 'bignumber' ? 90 : undefined,
      });
      selectOne(scene.id);
      return { ...p, scenes: [...p.scenes, scene], updatedAt: new Date().toISOString() };
    });

  const handleSave = async () => {
    setStatus('Saving…');
    if (IS_STATIC) {
      saveLocalProject(project);
    } else {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
    }
    setStatus('Saved');
    refreshProjectList();
    setTimeout(() => setStatus(''), 1500);
  };

  const handleLoad = async (id: string) => {
    if (!id) return;
    if (IS_STATIC) {
      const loaded = loadLocalProject(id);
      if (!loaded) return;
      setProject(loaded);
      selectOne(loaded.scenes[0]?.id ?? null);
      setMode('edit');
      return;
    }
    const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const loaded = (await res.json()) as Project;
    setProject(loaded);
    setSelectedSceneId(loaded.scenes[0]?.id ?? null);
    setMode('edit');
  };

  const handleBulkSceneUpdate = (updates: { id: string; patch: Partial<Scene> }[]) =>
    setProject((p) => {
      const map = new Map(updates.map((u) => [u.id, u.patch]));
      return {
        ...p,
        scenes: p.scenes.map((s) => (map.has(s.id) ? { ...s, ...map.get(s.id) } : s)),
        updatedAt: new Date().toISOString(),
      };
    });

  const handleAutoSelectBroll = async () => {
    const eligible = project.scenes.filter((s) => !s.broll);
    if (eligible.length === 0) {
      setBrollStatus('Every scene already has b-roll.');
      setTimeout(() => setBrollStatus(''), 2000);
      return;
    }
    setBrollBusy(true);
    setBrollStatus(`Finding b-roll for ${eligible.length} scene(s)…`);
    try {
      const res = await fetch('/api/broll/autoselect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: project.scenes }),
      });
      const data = (await res.json()) as {
        updates?: { id: string; patch: Partial<Scene> }[];
        skipped?: { id: string; reason: string }[];
      };
      if (data.updates?.length) handleBulkSceneUpdate(data.updates);
      const skippedCount = data.skipped?.length || 0;
      setBrollStatus(
        skippedCount
          ? `Added b-roll to ${data.updates?.length || 0} scene(s), skipped ${skippedCount}.`
          : `Added b-roll to ${data.updates?.length || 0} scene(s).`
      );
    } catch {
      setBrollStatus('Auto-select failed.');
    } finally {
      setBrollBusy(false);
      setTimeout(() => setBrollStatus(''), 4000);
    }
  };

  const handleNew = () => {
    setProject(createEmptyProject());
    selectOne(null);
    setScriptText('');
    setMode('plan');
  };

  const selectedScene = project.scenes.find((s) => s.id === selectedSceneId) || null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-white">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-[#1f1f1f]/90 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <h1 className="text-[1.25rem] font-semibold tracking-tight text-white">TypoAnimation</h1>
          <div className="flex rounded-xl border border-white/10 bg-[#141414] p-0.5">
            {(['plan', 'edit'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-[10px] px-3.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  mode === m ? 'bg-gradient-to-br from-[#ff6b35] to-[#ff4757] text-white' : 'text-white/55 hover:text-white/85'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && <span className="text-xs text-white/45">{status}</span>}
          <select
            defaultValue=""
            onChange={(e) => handleLoad(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs text-white"
          >
            <option value="" disabled className="bg-[#1f1f1f]">
              Load project…
            </option>
            {savedProjects.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#1f1f1f]">
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
          >
            Save
          </button>
          <button
            onClick={handleNew}
            className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] hover:border-white/15"
          >
            New
          </button>
          <button
            onClick={handleAutoSetStyles}
            disabled={project.scenes.length === 0}
            title="Re-picks each scene's style (Poster, Big number, Chips, Plain) from its current text"
            className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] hover:border-white/15 disabled:opacity-40"
          >
            Auto-set scene types
          </button>
          {!IS_STATIC && (
            <div className="ml-2 border-l border-white/10 pl-3">
              <ExportPanel project={project} />
            </div>
          )}
        </div>
      </header>

      {mode === 'plan' ? (
        <div className="flex flex-1 justify-center overflow-hidden p-4">
          <div className="flex w-full max-w-2xl flex-col">
            <div className="flex flex-1 flex-col rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <ScriptEditor value={scriptText} onChange={setScriptText} onGenerate={handleGenerate} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-[340px_1fr_320px] gap-4 p-4">
          <div className="flex flex-col gap-4 overflow-y-auto">
            <SceneList
              scenes={project.scenes}
              theme={project.theme}
              selectedId={selectedSceneId}
              multiSelectedIds={multiSelectedIds}
              onSelect={handleSelectScene}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onDuplicate={handleDuplicate}
              onAdd={handleAdd}
            />
            {IS_STATIC ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 text-xs text-white/45 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                Webcam voice sync, b-roll, and MP4 export need a real server (ffmpeg, local
                speech-to-text, video rendering) — this preview build is static. Run the full app
                locally (see the Saas hub card) for those.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                  <button
                    onClick={handleAutoSelectBroll}
                    disabled={brollBusy || project.scenes.length === 0}
                    className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] disabled:opacity-50"
                  >
                    {brollBusy ? 'Selecting b-roll…' : 'Auto-select b-roll for all scenes'}
                  </button>
                  {brollStatus && <p className="text-xs text-white/45">{brollStatus}</p>}
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                  <VideoSyncPanel project={project} onProjectChange={patchProject} onBulkSceneUpdate={handleBulkSceneUpdate} />
                </div>
              </>
            )}
          </div>

          <div className="flex items-start justify-center">
            <div
              className="w-full"
              style={{ maxWidth: project.aspectRatio === '16:9' ? 900 : project.aspectRatio === '9:16' ? 360 : 640 }}
            >
              <PreviewPlayer project={project} selectedSceneId={selectedSceneId} />
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto">
            <button
              onClick={() => setThemeOverlayOpen(true)}
              className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-colors hover:bg-[#252525]"
            >
              <span className="text-[0.95rem] font-semibold text-white">Theme settings</span>
              <span className="text-xs text-white/45">Colors, fonts, captions →</span>
            </button>
            <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              {multiSelectedIds.length > 1 ? (
                <BulkEditPanel sceneIds={multiSelectedIds} onApply={handleBulkPatch} />
              ) : (
                <SceneStylePanel scene={selectedScene} onChange={patchScene} hideBroll={IS_STATIC} />
              )}
            </div>
          </div>
        </div>
      )}

      <SettingsOverlay open={themeOverlayOpen} onClose={() => setThemeOverlayOpen(false)} title="Theme settings">
        <ThemePanel project={project} onChange={patchProject} />
      </SettingsOverlay>
    </div>
  );
}
