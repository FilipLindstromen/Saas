import { promises as fs } from 'fs';
import path from 'path';
import type { Project } from '@/types/project';

const DATA_DIR = path.join(process.cwd(), 'data', 'projects');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function projectPath(id: string) {
  // ids come from crypto.randomUUID() client-side; strip anything that isn't safe on disk.
  const safe = id.replace(/[^a-zA-Z0-9-_]/g, '');
  return path.join(DATA_DIR, `${safe}.json`);
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const summaries: ProjectSummary[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
      const project = JSON.parse(raw) as Project;
      summaries.push({ id: project.id, name: project.name, updatedAt: project.updatedAt });
    } catch {
      // skip unreadable/corrupt files rather than failing the whole listing
    }
  }
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

export async function loadProject(id: string): Promise<Project | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(projectPath(id), 'utf-8');
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export async function saveProject(project: Project): Promise<void> {
  await ensureDir();
  await fs.writeFile(projectPath(project.id), JSON.stringify(project, null, 2), 'utf-8');
}

export async function deleteProject(id: string): Promise<void> {
  await ensureDir();
  try {
    await fs.unlink(projectPath(id));
  } catch {
    // already gone
  }
}
