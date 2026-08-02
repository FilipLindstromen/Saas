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
  /** background for inline-highlighted [[ ]] text spans — falls back to accent if unset */
  highlightColor: string;
  /** ink on inline-highlighted [[ ]] spans — falls back to scene ink if unset */
  highlightInk: string;
}

// Merges the project-wide theme with a scene's own overrides (dark mode, accent color,
// font pairing) into the concrete values a scene component renders with. Dark scenes flip
// the roles: the accent becomes the full-bleed background and `bg` becomes the ink/chip
// color, matching the reference's Hook/Tease/FinalCTA treatment. `secondaryBg` is a second,
// independent bg/ink pairing a scene can opt into instead — picking the bg always brings its
// paired ink along, never set separately. `dark` takes precedence if both are on.
export function resolveSceneTheme(theme: ProjectTheme, scene: Scene): ResolvedSceneTheme {
  const accent = scene.accentColor || theme.accent;
  const pairing = getFontPairing(scene.font || theme.fontPairing);
  const dark = !!scene.dark;
  const useSecondary = !dark && !!scene.secondaryBg && !!theme.secondaryBg;
  const ink = dark ? theme.bg : useSecondary ? theme.secondaryInk || theme.ink : theme.ink;
  return {
    bg: dark ? accent : useSecondary ? theme.secondaryBg! : theme.bg,
    ink,
    accent,
    accentDeep: deepen(accent),
    fontHeading: pairing.heading,
    fontBody: pairing.body,
    headingWeight: pairing.headingWeight,
    kickerWeight: pairing.kickerWeight,
    dark,
    fontScale: theme.fontScale ?? 1,
    highlightColor: theme.highlightColor || accent,
    highlightInk: theme.highlightInk ?? ink,
  };
}
