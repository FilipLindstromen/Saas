// Font pairings selectable as a project/scene "style". Loaded via @remotion/google-fonts,
// which bundles the woff2 locally (no network dependency during render) and no-ops on the
// server (SSR-safe) — see base.js's `typeof FontFace === 'undefined'` guard. Only import this
// module from Remotion scene components (mounted under <Player>/the renderer), not from plain
// Next.js pages.
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';

const archivo = loadArchivo('normal', { weights: ['400', '700', '800', '900'], subsets: ['latin'] });
const anton = loadAnton('normal', { weights: ['400'], subsets: ['latin'] });
const inter = loadInter('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] });
const spaceGrotesk = loadSpaceGrotesk('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
const playfair = loadPlayfairDisplay('normal', { weights: ['700', '900'], subsets: ['latin'] });

export interface FontPairing {
  key: string;
  label: string;
  heading: string;
  body: string;
  headingWeight: number;
  kickerWeight: number;
}

export const FONT_PAIRINGS: Record<string, FontPairing> = {
  archivo: {
    key: 'archivo',
    label: 'Archivo (default)',
    heading: archivo.fontFamily,
    body: archivo.fontFamily,
    headingWeight: 900,
    kickerWeight: 800,
  },
  anton: {
    key: 'anton',
    label: 'Anton / Inter',
    heading: anton.fontFamily,
    body: inter.fontFamily,
    headingWeight: 400,
    kickerWeight: 700,
  },
  spacegrotesk: {
    key: 'spacegrotesk',
    label: 'Space Grotesk',
    heading: spaceGrotesk.fontFamily,
    body: inter.fontFamily,
    headingWeight: 700,
    kickerWeight: 600,
  },
  playfair: {
    key: 'playfair',
    label: 'Playfair / Inter',
    heading: playfair.fontFamily,
    body: inter.fontFamily,
    headingWeight: 900,
    kickerWeight: 700,
  },
};

export const FONT_PAIRING_KEYS = Object.keys(FONT_PAIRINGS);

export function getFontPairing(key?: string): FontPairing {
  return (key && FONT_PAIRINGS[key]) || FONT_PAIRINGS.archivo;
}

export function waitForFonts(): Promise<void> {
  return Promise.all([
    archivo.waitUntilDone(),
    anton.waitUntilDone(),
    inter.waitUntilDone(),
    spaceGrotesk.waitUntilDone(),
    playfair.waitUntilDone(),
  ]).then(() => undefined);
}
