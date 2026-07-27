'use client';

import React, { useEffect, useState } from 'react';
import { createEmptyProject, createScene, type Project, type Scene, type SceneStyle } from '@/types/project';
import { parseScript } from '@/lib/parseScript';
import { PreviewPlayer } from '@/components/PreviewPlayer';
import { ScriptEditor } from '@/components/ScriptEditor';
import { SceneList } from '@/components/SceneList';
import { SceneStylePanel } from '@/components/SceneStylePanel';
import { ThemePanel } from '@/components/ThemePanel';
import { VideoSyncPanel } from '@/components/VideoSyncPanel';
import { ExportPanel } from '@/components/ExportPanel';
import type { ProjectSummary } from '@/lib/projectStore';

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
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState<string>('');

  const refreshProjectList = () => {
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

  const patchScene = (id: string, patch: Partial<Scene>) =>
    setProject((p) => ({
      ...p,
      scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      updatedAt: new Date().toISOString(),
    }));

  const handleGenerate = () => {
    const scenes = parseScript(scriptText);
    setProject((p) => ({ ...p, scenes, updatedAt: new Date().toISOString() }));
    setSelectedSceneId(scenes[0]?.id ?? null);
  };

  const handleMove = (id: string, direction: -1 | 1) =>
    setProject((p) => {
      const idx = p.scenes.findIndex((s) => s.id === id);
      const next = idx + direction;
      if (idx < 0 || next < 0 || next >= p.scenes.length) return p;
      const scenes = p.scenes.slice();
      [scenes[idx], scenes[next]] = [scenes[next], scenes[idx]];
      return { ...p, scenes, updatedAt: new Date().toISOString() };
    });

  const handleRemove = (id: string) =>
    setProject((p) => ({ ...p, scenes: p.scenes.filter((s) => s.id !== id), updatedAt: new Date().toISOString() }));

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
        lines: [{ text: 'New line' }],
        dark: style === 'poster',
        compareRows:
          style === 'compare'
            ? [
                { label: 'Option A', sub: 'slow', value: 0.8 },
                { label: 'Option B', sub: 'fast', value: 0.2, accent: true },
              ]
            : undefined,
        number: style === 'bignumber' ? 90 : undefined,
      });
      setSelectedSceneId(scene.id);
      return { ...p, scenes: [...p.scenes, scene], updatedAt: new Date().toISOString() };
    });

  const handleSave = async () => {
    setStatus('Saving…');
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    setStatus('Saved');
    refreshProjectList();
    setTimeout(() => setStatus(''), 1500);
  };

  const handleLoad = async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const loaded = (await res.json()) as Project;
    setProject(loaded);
    setSelectedSceneId(loaded.scenes[0]?.id ?? null);
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

  const handleNew = () => {
    setProject(createEmptyProject());
    setSelectedSceneId(null);
    setScriptText('');
  };

  const selectedScene = project.scenes.find((s) => s.id === selectedSceneId) || null;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5">
        <h1 className="text-base font-semibold">TypoAnimation</h1>
        <div className="flex items-center gap-2">
          {status && <span className="text-xs text-neutral-500">{status}</span>}
          <select
            defaultValue=""
            onChange={(e) => handleLoad(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs"
          >
            <option value="" disabled>
              Load project…
            </option>
            {savedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button onClick={handleSave} className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
            Save
          </button>
          <button onClick={handleNew} className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100">
            New
          </button>
          <div className="ml-2 border-l border-neutral-200 pl-2">
            <ExportPanel project={project} />
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[340px_1fr_320px] gap-4 p-4">
        <div className="flex flex-col gap-4 overflow-y-auto">
          <ScriptEditor value={scriptText} onChange={setScriptText} onGenerate={handleGenerate} />
          <SceneList
            scenes={project.scenes}
            selectedId={selectedSceneId}
            onSelect={setSelectedSceneId}
            onMove={handleMove}
            onRemove={handleRemove}
            onDuplicate={handleDuplicate}
            onAdd={handleAdd}
          />
          <div className="border-t border-neutral-200 pt-3">
            <VideoSyncPanel project={project} onProjectChange={patchProject} onBulkSceneUpdate={handleBulkSceneUpdate} />
          </div>
        </div>

        <div className="flex items-start justify-center">
          <div className="w-full max-w-[640px]">
            <PreviewPlayer project={project} />
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          <ThemePanel project={project} onChange={patchProject} />
          <div className="border-t border-neutral-200 pt-3">
            <SceneStylePanel scene={selectedScene} onChange={patchScene} />
          </div>
        </div>
      </div>
    </div>
  );
}
