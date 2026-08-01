'use client';

import React, { useEffect, useState } from 'react';
import { createEmptyProject, createScene, defaultDurationForStyle, type Project, type Scene, type SceneStyle } from '@/types/project';
import { parseScript, parseStructuredScript, serializeScript, pickSceneStyle, estimateDuration, assignSceneStylesWithVariety, scenePatchForStyle } from '@/lib/parseScript';
import { PreviewPlayer } from '@/components/PreviewPlayer';
import { ScriptEditor } from '@/components/ScriptEditor';
import { SceneList } from '@/components/SceneList';
import { SceneStylePanel } from '@/components/SceneStylePanel';
import { BulkEditPanel } from '@/components/BulkEditPanel';
import { ThemePanel } from '@/components/ThemePanel';
import { SettingsOverlay } from '@/components/SettingsOverlay';
import { VideoSyncPanel } from '@/components/VideoSyncPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { PresentView } from '@/components/PresentView';
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
  const [brollPanMode, setBrollPanMode] = useState(false);
  // 'import' is an optional first step (upload + transcribe a video, then generate scenes
  // straight from the transcript with correct timing) — never required, always reachable via
  // the header toggle, just the thing shown first for a fresh project.
  const [mode, setMode] = useState<'import' | 'plan' | 'edit'>('import');
  const [themeOverlayOpen, setThemeOverlayOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);

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
    setProject((p) => {
      const next = { ...p, ...patch, updatedAt: new Date().toISOString() };
      // Changing the pacing multiplier re-fits every non-voiceover-locked scene's duration
      // immediately, not just future edits — "automatic" means the multiplier is the only
      // duration control, so it has to actually move existing scenes too.
      const prevMult = p.theme.durationMultiplier ?? 1;
      const nextMult = next.theme.durationMultiplier ?? 1;
      if (nextMult !== prevMult) {
        next.scenes = next.scenes.map((s) =>
          s.wordTimings ? s : { ...s, durationSec: estimateDuration(s.kicker, s.lines) * nextMult }
        );
      }
      return next;
    });

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
        // Content edits re-fit the duration to the new word count (scaled by the project's
        // pacing multiplier), unless this scene is voiceover-synced (wordTimings set) — that
        // duration must stay locked to the audio track regardless of text edits. Duration is
        // never set directly anymore (no per-scene field), so this always wins on content edits.
        if (('lines' in patch || 'kicker' in patch) && !next.wordTimings) {
          next.durationSec = estimateDuration(next.kicker, next.lines) * (p.theme.durationMultiplier ?? 1);
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
    setProject((p) => {
      const styles = assignSceneStylesWithVariety(p.scenes.map((s) => ({ kicker: s.kicker, lines: s.lines })));
      return {
        ...p,
        scenes: p.scenes.map((s, i) => {
          const patch = scenePatchForStyle(s, styles[i]);
          return {
            ...s,
            ...patch,
            durationSec: s.wordTimings
              ? s.durationSec
              : estimateDuration(s.kicker, patch.lines) * (p.theme.durationMultiplier ?? 1),
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });

  const handleGenerate = () => {
    setProject((p) => {
      const mult = p.theme.durationMultiplier ?? 1;
      const scenes = parseScript(scriptText).map((s) => ({ ...s, durationSec: s.durationSec * mult }));
      selectOne(scenes[0]?.id ?? null);
      return { ...p, scenes, updatedAt: new Date().toISOString() };
    });
    setMode('edit');
  };

  // Re-parses the script text and patches each EXISTING scene's name/kicker/lines by
  // position, leaving style/duration/colors/font/b-roll/wordTimings untouched — unlike
  // handleGenerate, which throws away and rebuilds every scene from scratch. Extra blocks
  // beyond the current scene count are appended as new scenes; fewer blocks just leaves the
  // trailing scenes as they were.
  const handleUpdateCopy = () => {
    const blocks = parseStructuredScript(scriptText);
    setProject((p) => {
      const mult = p.theme.durationMultiplier ?? 1;
      const scenes = p.scenes.map((s, i) => {
        const b = blocks[i];
        if (!b) return s;
        const next = { ...s, name: b.name, kicker: b.kicker || undefined, lines: b.lines };
        if (!next.wordTimings) next.durationSec = estimateDuration(next.kicker, next.lines) * mult;
        return next;
      });
      for (let i = p.scenes.length; i < blocks.length; i++) {
        const b = blocks[i];
        const style = pickSceneStyle(b.kicker, b.lines);
        scenes.push(createScene({ name: b.name, style, kicker: b.kicker || undefined, lines: b.lines, durationSec: estimateDuration(b.kicker, b.lines) * mult }));
      }
      if (blocks.length > 0) {
        const styles = assignSceneStylesWithVariety(scenes.map((s) => ({ kicker: s.kicker, lines: s.lines })));
        for (let i = 0; i < scenes.length; i++) {
          const patch = scenePatchForStyle(scenes[i], styles[i]);
          scenes[i] = { ...scenes[i], ...patch };
        }
      }
      return { ...p, scenes, updatedAt: new Date().toISOString() };
    });
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
        durationSec: defaultDurationForStyle(style) * (p.theme.durationMultiplier ?? 1),
        lines:
          style === 'rotate'
            ? [{ text: 'We are' }]
            : style === 'mosaic'
              ? [
                  { text: 'Fast' },
                  { text: 'Paced', accent: true },
                  { text: 'High' },
                  { text: 'Energy', accent: true },
                  { text: 'Creative' },
                  { text: 'Graphics' },
                ]
              : style === 'badge'
                ? [{ text: 'Creative pack' }]
                : [{ text: 'New line' }],
        kicker: style === 'badge' ? 'Try now!' : undefined,
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
    // Scoped to the multi-selection when 2+ scenes are selected, otherwise every scene —
    // same "fill gaps, don't replace existing picks" behavior either way.
    const targetScenes = multiSelectedIds.length > 1 ? project.scenes.filter((s) => multiSelectedIds.includes(s.id)) : project.scenes;
    const eligible = targetScenes.filter((s) => !s.broll);
    if (eligible.length === 0) {
      setBrollStatus('Every targeted scene already has b-roll.');
      setTimeout(() => setBrollStatus(''), 2000);
      return;
    }
    setBrollBusy(true);
    setBrollStatus(`Finding b-roll for ${eligible.length} scene(s)…`);
    try {
      const res = await fetch('/api/broll/autoselect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: targetScenes }),
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
    setMode('import');
  };

  const selectedScene = project.scenes.find((s) => s.id === selectedSceneId) || null;

  useEffect(() => {
    if (!selectedScene?.broll) setBrollPanMode(false);
  }, [selectedSceneId, selectedScene?.broll]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#1f1f1f]/90 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <h1 className="text-[1.25rem] font-semibold tracking-tight text-white">TypoAnimation</h1>
          <div className="flex rounded-xl border border-white/10 bg-[#141414] p-0.5">
            {(['import', 'plan', 'edit'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  // Entering Plan with existing scenes re-syncs the textarea from them, so
                  // whatever's on the canvas is what you see and edit — not whatever script
                  // text happened to be left over from before those scenes existed.
                  if (m === 'plan' && project.scenes.length > 0) setScriptText(serializeScript(project.scenes));
                  setMode(m);
                }}
                className={`rounded-[10px] px-3.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  mode === m ? 'bg-gradient-to-br from-[#ff6b35] to-[#ff4757] text-white' : 'text-white/55 hover:text-white/85'
                }`}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              disabled={project.scenes.length === 0}
              onClick={() => setPresentOpen(true)}
              className="rounded-[10px] px-3.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:text-white/55 bg-white/10 text-white hover:bg-white/15"
              title="Fullscreen slide presentation (↑↓ to navigate)"
            >
              Present
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(status || brollStatus) && (
            <span className="max-w-[220px] truncate text-xs text-white/45">{brollStatus || status}</span>
          )}
          <button
            onClick={() => setThemeOverlayOpen(true)}
            className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] hover:border-white/15"
          >
            Theme settings
          </button>
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
            title="Re-picks each scene's style from its text, with varied types across the timeline"
            className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] hover:border-white/15 disabled:opacity-40"
          >
            Auto-set scene types
          </button>
          {!IS_STATIC && (
            <button
              onClick={handleAutoSelectBroll}
              disabled={brollBusy || project.scenes.length === 0}
              title={
                multiSelectedIds.length > 1
                  ? `Fill b-roll for ${multiSelectedIds.length} selected scenes without existing picks`
                  : 'Fill b-roll for all scenes without existing picks'
              }
              className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] hover:border-white/15 disabled:opacity-50"
            >
              {brollBusy
                ? 'Selecting b-roll…'
                : multiSelectedIds.length > 1
                  ? `Auto-select b-roll (${multiSelectedIds.length})`
                  : 'Auto-select b-roll'}
            </button>
          )}
          {!IS_STATIC && (
            <div className="ml-2 border-l border-white/10 pl-3">
              <ExportPanel project={project} />
            </div>
          )}
        </div>
      </header>

      {mode === 'import' ? (
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4">
          <div className="flex w-full max-w-lg flex-col gap-4">
            <div className="flex flex-col gap-1 text-center">
              <h2 className="text-[1.1rem] font-semibold text-white">Start from a video (optional)</h2>
              <p className="text-xs text-white/45">
                Upload a webcam/voiceover recording and transcribe it, and scenes get generated straight from what was
                actually said — correct timing included, no separate sync step. Skip this if you'd rather just type a script.
              </p>
            </div>
            {IS_STATIC ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 text-center text-xs text-white/45 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                Upload/transcribe need a real server (ffmpeg, local speech-to-text) — this preview build is static. Run
                the full app locally (see the Saas hub card) for that.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                <VideoSyncPanel
                  project={project}
                  onProjectChange={patchProject}
                  onBulkSceneUpdate={handleBulkSceneUpdate}
                  onGenerated={(scenes) => {
                    selectOne(scenes[0]?.id ?? null);
                    setMode('edit');
                  }}
                />
              </div>
            )}
            <button
              onClick={() => setMode('plan')}
              className="self-center rounded-xl border border-white/10 bg-[#141414] px-4 py-1.5 text-xs font-medium text-white/65 transition-colors hover:bg-[#252525] hover:text-white/90"
            >
              Skip — write a script instead →
            </button>
          </div>
        </div>
      ) : mode === 'plan' ? (
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4">
          <div className="flex w-full max-w-2xl flex-col gap-4">
            <div className="flex min-h-[min(480px,50vh)] flex-col rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <ScriptEditor
                value={scriptText}
                onChange={setScriptText}
                onGenerate={handleGenerate}
                onUpdateCopy={handleUpdateCopy}
                showUpdateCopy={project.scenes.length > 0 && scriptText !== serializeScript(project.scenes)}
              />
            </div>
            {IS_STATIC ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 text-center text-xs text-white/45 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                Voice sync needs a real server — run the full app locally for upload and transcribe.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                <VideoSyncPanel
                  project={project}
                  onProjectChange={patchProject}
                  onBulkSceneUpdate={handleBulkSceneUpdate}
                  onGenerated={(scenes) => {
                    selectOne(scenes[0]?.id ?? null);
                    setMode('edit');
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr_320px] gap-4 overflow-hidden p-4">
          <div className="flex min-h-0 flex-col overflow-hidden">
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
          </div>

          <div className="flex min-h-0 items-start justify-center overflow-hidden">
            <div
              className="w-full"
              style={{ maxWidth: project.aspectRatio === '16:9' ? 900 : project.aspectRatio === '9:16' ? 360 : 640 }}
            >
              <PreviewPlayer
                project={project}
                selectedSceneId={selectedSceneId}
                brollPanMode={brollPanMode}
                onBrollPatch={(p) => {
                  if (!selectedSceneId || !selectedScene?.broll) return;
                  patchScene(selectedSceneId, { broll: { ...selectedScene.broll, ...p } });
                }}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto">
            <div className="rounded-2xl border border-white/[0.06] bg-[#1f1f1f] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              {multiSelectedIds.length > 1 ? (
                <BulkEditPanel sceneIds={multiSelectedIds} onApply={handleBulkPatch} />
              ) : (
                <SceneStylePanel
                  scene={selectedScene}
                  onChange={patchScene}
                  hideBroll={IS_STATIC}
                  hasVideo={!!project.video}
                  brollPanMode={brollPanMode}
                  onBrollPanModeChange={setBrollPanMode}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <SettingsOverlay open={themeOverlayOpen} onClose={() => setThemeOverlayOpen(false)} title="Theme settings">
        <ThemePanel project={project} onChange={patchProject} />
      </SettingsOverlay>

      {presentOpen && project.scenes.length > 0 && (
        <PresentView
          project={project}
          initialSceneIndex={
            selectedSceneId ? Math.max(0, project.scenes.findIndex((s) => s.id === selectedSceneId)) : 0
          }
          onClose={() => setPresentOpen(false)}
        />
      )}
    </div>
  );
}
