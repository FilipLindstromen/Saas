// UI-facing metadata only (key + label) for the font-pairing picker. Deliberately has no
// dependency on @remotion/google-fonts — the actual font loading (src/remotion/shared/fonts.ts)
// must only run inside Remotion scene components, since it relies on Remotion's
// delayRender/continueRender render-blocking machinery. Keep this list's keys in sync with
// FONT_PAIRINGS there.
export interface FontPairingMeta {
  key: string;
  label: string;
}

export const FONT_PAIRING_OPTIONS: FontPairingMeta[] = [
  { key: 'archivo', label: 'Archivo (default)' },
  { key: 'anton', label: 'Anton / Inter' },
  { key: 'spacegrotesk', label: 'Space Grotesk' },
  { key: 'playfair', label: 'Playfair / Inter' },
];
