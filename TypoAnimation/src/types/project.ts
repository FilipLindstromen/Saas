export type SceneStyle = 'plain' | 'poster' | 'bignumber' | 'compare' | 'chips';

export interface SceneLine {
  text: string;
  accent?: boolean;
}

export interface CompareRow {
  label: string;
  sub: string;
  /** 0..1 relative bar fill */
  value: number;
  accent?: boolean;
}

export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface Scene {
  id: string;
  name: string;
  style: SceneStyle;
  /** editable; once wordTimings is set this is derived from it and locked */
  durationSec: number;
  kicker?: string;
  lines: SceneLine[];
  dark?: boolean;
  /** per-scene override of theme.accent */
  accentColor?: string;
  /** per-scene override of theme.fontPairing, key into FONT_PAIRINGS */
  font?: string;
  /** 'bignumber' style target value */
  number?: number;
  numberSuffix?: string;
  /** 'compare' style rows */
  compareRows?: CompareRow[];
  /** present once this scene has been synced to an uploaded voiceover */
  wordTimings?: CaptionWord[];
}

export interface ProjectTheme {
  bg: string;
  ink: string;
  accent: string;
  /** key into FONT_PAIRINGS */
  fontPairing: string;
}

export interface VideoAsset {
  path: string;
  durationMs: number;
  mode: 'background' | 'pip' | 'hidden';
  /** offset into the source video where composition frame 0 begins, set when scenes are synced to VO */
  trimStartMs?: number;
}

export interface Project {
  id: string;
  name: string;
  /** chrome eyebrow label, top-left of every scene (defaults to the project name) */
  label?: string;
  showCaptions?: boolean;
  showTimecode?: boolean;
  theme: ProjectTheme;
  scenes: Scene[];
  video?: VideoAsset;
  /** full transcript with word-level timestamps, present once a video has been transcribed */
  captions?: CaptionWord[];
  updatedAt: string;
}

export const DEFAULT_THEME: ProjectTheme = {
  bg: '#f3f2f2',
  ink: '#201e1d',
  accent: '#ec3013',
  fontPairing: 'archivo',
};

export function createEmptyProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled project',
    theme: { ...DEFAULT_THEME },
    scenes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createScene(partial: Partial<Scene> & { style: SceneStyle }): Scene {
  return {
    id: crypto.randomUUID(),
    lines: [],
    ...partial,
    name: partial.name || 'Scene',
    durationSec: partial.durationSec ?? defaultDurationForStyle(partial.style),
  };
}

export function defaultDurationForStyle(style: SceneStyle): number {
  switch (style) {
    case 'poster':
      return 3.2;
    case 'bignumber':
      return 3.5;
    case 'compare':
      return 3.8;
    case 'chips':
      return 3.4;
    case 'plain':
    default:
      return 2.6;
  }
}
