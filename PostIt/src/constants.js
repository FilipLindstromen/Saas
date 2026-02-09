export const POSTIT_WIDTH = 280;
export const POSTIT_MIN_HEIGHT = 96;

export const POSTIT_COLORS = [
  { gradient: 'linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%)', pin: '#94a3b8', num: '#374151' },   // white / standard card
  { gradient: 'linear-gradient(135deg, #bfdbfe 0%, #e9d5ff 60%, #fbcfe8 100%)', pin: '#8b5cf6', num: '#6d28d9' },   // blue → pink
  { gradient: 'linear-gradient(135deg, #bfdbfe 0%, #a5f3fc 50%, #99f6e4 100%)', pin: '#06b6d4', num: '#0d9488' },   // blue → teal
  { gradient: 'linear-gradient(145deg, #faf6f0 0%, #f0e8dc 100%)', pin: '#a8a29e', num: '#78716c' },   // light beige
  { gradient: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)', pin: '#60a5fa', num: '#2563eb' },   // soft gray + blue
  { gradient: 'linear-gradient(145deg, #ccfbf1 0%, #99f6e4 100%)', pin: '#14b8a6', num: '#0d9488' },   // mint / teal
];

export const GOOGLE_FONTS = [
  { name: 'DM Sans', family: '"DM Sans", sans-serif' },
  { name: 'Inter', family: '"Inter", sans-serif' },
  { name: 'Source Sans 3', family: '"Source Sans 3", sans-serif' },
  { name: 'Outfit', family: '"Outfit", sans-serif' },
  { name: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans", sans-serif' },
  { name: 'Playfair Display', family: '"Playfair Display", serif' },
];

export const STORAGE_KEY = 'postit-board-state';
export const OPENAI_API_KEY_STORAGE = 'postit-openai-api-key';
export const SNAP_GRID = 20;
