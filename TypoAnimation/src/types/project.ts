export type SceneStyle = 'plain' | 'poster' | 'bignumber' | 'compare' | 'chips' | 'falling' | 'videotext' | 'rotate' | 'typewriter';

export interface SceneLine {
  text: string;
  accent?: boolean;
  /** accent treatment: a solid-fill pill (default) or an animated highlighter-marker sweep */
  emphasis?: 'chip' | 'marker';
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

export interface BrollAsset {
  /** local /broll/... path, downloaded from the provider so rendering never depends on a live external URL */
  path: string;
  provider: 'pexels' | 'pixabay';
  sourceId: string;
  thumbnail?: string;
  credit?: string;
  /** 0..1 dark scrim over the video so text stays readable; defaults to 0.45 */
  opacity?: number;
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
  /** stock b-roll video behind this scene's content, from Pexels/Pixabay */
  broll?: BrollAsset;
  /** 'rotate' style: words/phrases that cycle in the rotating slot after `lines` */
  rotatingWords?: string[];
  /** brief RGB-split/jitter treatment over the scene's first ~0.18s */
  glitchIntro?: boolean;
}

export interface ProjectTheme {
  bg: string;
  ink: string;
  accent: string;
  /** key into FONT_PAIRINGS */
  fontPairing: string;
  /** how scenes hand off to each other; defaults to a hard cut */
  transition?: 'cut' | 'fade' | 'slide' | 'wipe';
}

export interface VideoAsset {
  path: string;
  durationMs: number;
  mode: 'background' | 'pip' | 'hidden';
  /** offset into the source video where composition frame 0 begins, set when scenes are synced to VO */
  trimStartMs?: number;
}

/** work-area / export shape: 1080x1080, 1920x1080 (landscape), or 1080x1920 (portrait) */
export type AspectRatio = '1:1' | '16:9' | '9:16';

export interface Project {
  id: string;
  name: string;
  /** chrome eyebrow label, top-left of every scene (defaults to the project name) */
  label?: string;
  showCaptions?: boolean;
  showTimecode?: boolean;
  /** defaults to '1:1' (1080x1080) when unset, for backward compatibility with older projects */
  aspectRatio?: AspectRatio;
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
    case 'falling':
      return 4.5;
    case 'videotext':
      return 3.4;
    case 'rotate':
      return 4.2;
    case 'typewriter':
      return 4.8;
    case 'plain':
    default:
      return 2.6;
  }
}
