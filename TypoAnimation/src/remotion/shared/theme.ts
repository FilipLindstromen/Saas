import type { ProjectTheme, Scene } from '@/types/project';
import { deepen } from '@/lib/colors';
import { getFontPairing } from './fonts';

export interface ResolvedSceneTheme {
  bg: string;
  ink: string;
  accent: string;
  accentDeep: string;
  fontHeading: string;
  fontBody: string;
  headingWeight: number;
  kickerWeight: number;
  dark: boolean;
  /** global text-size multiplier (project.theme.fontScale, defaults to 1) — every scene
   * component multiplies its own hardcoded pixel sizes by this. */
  fontScale: number;
}

// Merges the project-wide theme with a scene's own overrides (dark mode, accent color,
// font pairing) into the concrete values a scene component renders with. Dark scenes flip
// the roles: the accent becomes the full-bleed background and `bg` becomes the ink/chip
// color, matching the reference's Hook/Tease/FinalCTA treatment.
export function resolveSceneTheme(theme: ProjectTheme, scene: Scene): ResolvedSceneTheme {
  const accent = scene.accentColor || theme.accent;
  const pairing = getFontPairing(scene.font || theme.fontPairing);
  const dark = !!scene.dark;
  return {
    bg: dark ? accent : theme.bg,
    ink: dark ? theme.bg : theme.ink,
    accent,
    accentDeep: deepen(accent),
    fontHeading: pairing.heading,
    fontBody: pairing.body,
    headingWeight: pairing.headingWeight,
    kickerWeight: pairing.kickerWeight,
    dark,
    fontScale: theme.fontScale ?? 1,
  };
}
