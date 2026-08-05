/**
 * Style presets for the generate step. `prompt` is appended to the base
 * instruction sent to the image edit API — see src/api/generate.js.
 */
export const STYLES = [
  {
    id: 'sketch',
    name: 'Pencil Sketch',
    emoji: '✏️',
    prompt: 'a clean, polished graphite pencil sketch with natural shading and cross-hatching, on a plain paper background',
  },
  {
    id: 'hand-drawn',
    name: 'Hand Drawn',
    emoji: '🖊️',
    prompt: 'a hand-drawn ink illustration with expressive linework and organic imperfections, like a page from an artist\'s sketchbook',
  },
  {
    id: 'graphic',
    name: 'Flat Graphic',
    emoji: '🎨',
    prompt: 'a bold flat-color vector graphic / poster illustration with clean shapes, a limited color palette, and crisp edges',
  },
  {
    id: '3d',
    name: '3D Render',
    emoji: '🧊',
    prompt: 'a polished 3D rendered illustration with realistic lighting, soft shadows, and dimensional depth, like a modern animated-film render',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    emoji: '💧',
    prompt: 'a soft watercolor painting with flowing pigment blooms, gentle color bleeding, and visible paper texture',
  },
  {
    id: 'anime',
    name: 'Anime',
    emoji: '🌸',
    prompt: 'a vibrant anime/manga illustration with clean cel-shaded coloring and expressive line art',
  },
  {
    id: 'realistic',
    name: 'Photorealistic',
    emoji: '📷',
    prompt: 'a photorealistic rendering with natural lighting, accurate materials, and lifelike detail',
  },
  {
    id: 'comic',
    name: 'Comic Ink',
    emoji: '💥',
    prompt: 'bold comic-book art with heavy ink outlines, dramatic shading, and halftone dot textures',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    emoji: '📐',
    prompt: 'a technical blueprint diagram: crisp white linework and annotations on a blue engineering-grid background',
  },
  {
    id: 'lowpoly',
    name: 'Low Poly',
    emoji: '🔺',
    prompt: 'a low-poly 3D illustration made of faceted geometric shapes with flat-shaded lighting',
  },
]

export const DEFAULT_STYLE_ID = STYLES[0].id
