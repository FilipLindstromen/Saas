export const LANGUAGE_COLORS = {
  sv: '#4da6ff',
  en: '#ff5c5c',
};

export const NEUTRAL_COLOR = '#e7e9ee';

const PALETTE = [
  '#f472b6', // pink
  '#34d399', // green
  '#fb923c', // orange
  '#a78bfa', // purple
  '#2dd4bf', // teal
  '#facc15', // yellow
  '#22d3ee', // cyan
  '#fb7185', // coral
  '#a3e635', // lime
  '#818cf8', // indigo
  '#fbbf24', // gold
  '#e879f9', // magenta
];

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// One random color per pair (word or sentence); consistent for the whole
// pair, distinct-ish from its neighbor so adjacent pairs don't blur together.
export function generateWordBasedColors(count) {
  const colors = [];
  let deck = shuffle(PALETTE);
  let prev = null;

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) deck = shuffle(PALETTE);
    if (deck[0] === prev && deck.length > 1) {
      [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    const color = deck.shift();
    colors.push(color);
    prev = color;
  }

  return colors;
}

// Same idea, but colors step through the rainbow in pair order instead of
// being shuffled, so the sequence itself is meaningful (red -> violet).
export function generateRainbowColors(count) {
  if (count <= 0) return [];
  if (count === 1) return ['hsl(0, 75%, 62%)'];

  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i / (count - 1)) * 300; // red through violet, no wrap back to red
    colors.push(`hsl(${hue.toFixed(0)}, 75%, 62%)`);
  }
  return colors;
}

// Darkens a "#rrggbb" color for use as the focus letter on top of that same
// color used as the background (Color BG mode).
export function darkenColor(hex, factor = 0.45) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const dark = (c) => Math.max(0, Math.round(c * factor));
  return `rgb(${dark(r)}, ${dark(g)}, ${dark(b)})`;
}
