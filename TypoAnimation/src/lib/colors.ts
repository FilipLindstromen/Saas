// Curated color presets (accent / bg / ink triples) a user can pick as a project theme,
// plus a custom-hex escape hatch. The Modernist reference ships #ec3013 on #f3f2f2 as its
// only combo; these give a few more starting points while keeping the same flat, high-contrast
// poster feel.
export interface ColorPreset {
  label: string;
  accent: string;
  bg: string;
  ink: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { label: 'Modernist Red', accent: '#ec3013', bg: '#f3f2f2', ink: '#201e1d' },
  { label: 'Signal Blue', accent: '#2a6fdb', bg: '#f2f4f8', ink: '#14181f' },
  { label: 'Acid Green', accent: '#1f8a5b', bg: '#f1f5f2', ink: '#14201a' },
  { label: 'Electric Violet', accent: '#7a5ae0', bg: '#f4f2fa', ink: '#1b1626' },
  { label: 'Amber', accent: '#d97706', bg: '#f6f2ea', ink: '#211a10' },
  { label: 'Ink on White', accent: '#111111', bg: '#ffffff', ink: '#111111' },
];

// Relative-luminance check so chip/checkmark contrast reads correctly against any accent —
// port of the reference tweaks-panel's __twkIsLight.
export function isLightColor(hex: string): boolean {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

// A deep, readable step of the accent for use as paragraph-size text on the light ground
// (mirrors the reference's --color-accent-700 role: the accent itself is only ~3:1 contrast,
// fine for chips/large display type but not body-size copy).
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function deepen(hex: string, amount = 0.28): string {
  const h = hex.replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
