import type { Project } from '@/types/project';

// Browser-only equivalent of lib/projectStore.ts (which writes JSON files to disk via a
// server route) — used by the static-export build, which has no server to write to.
const KEY = 'typoanimation-projects';

function readAll(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function writeAll(projects: Project[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function listLocalProjects(): { id: string; name: string; updatedAt: string }[] {
  return readAll()
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveLocalProject(project: Project): void {
  const all = readAll().filter((p) => p.id !== project.id);
  all.push(project);
  writeAll(all);
}

export function loadLocalProject(id: string): Project | null {
  return readAll().find((p) => p.id === id) || null;
}
