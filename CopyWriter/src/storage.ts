const STORAGE_KEYS = {
  API_KEY: 'copywriter_api_key',
  INSTRUCTIONS: 'copywriter_instructions',
  PROJECTS: 'copywriter_projects',
  ACTIVE_PROJECT: 'copywriter_active_project',
  ACTIVE_DOC: 'copywriter_active_doc',
  THEME: 'copywriter_theme',
} as const;

export type Theme = 'light' | 'dark';

export interface DocumentData {
  id: string;
  name: string;
  copyPurpose: string;
  targetAudience: string;
  originalText: string;
  generatedText: string;
  improvedCopy: string;
  questions: string;
  answers: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  suggestions: string;
  audienceAnalysis: string;
}

export interface ProjectData {
  id: string;
  name: string;
  documents: DocumentData[];
}

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) ?? '';
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key);
}

export function getInstructions(): string {
  return localStorage.getItem(STORAGE_KEYS.INSTRUCTIONS) ?? '';
}

export function setInstructions(instructions: string): void {
  localStorage.setItem(STORAGE_KEYS.INSTRUCTIONS, instructions);
}

export function getProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setProjects(projects: ProjectData[]): void {
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT);
}

export function setActiveProjectId(id: string | null): void {
  if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, id);
  else localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
}

export function getActiveDocId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_DOC);
}

export function setActiveDocId(id: string | null): void {
  if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC, id);
  else localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC);
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}
