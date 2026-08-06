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
  {
    id: 'pixels',
    name: 'Pixels',
    emoji: '👾',
    prompt: 'a retro pixel-art illustration with a visible square pixel grid, limited color palette, crisp hard edges, and no anti-aliasing — like classic 8-bit or 16-bit video game art',
  },
  {
    id: 'infographic',
    name: 'Info Graphic',
    emoji: '📊',
    prompt: 'a clean modern infographic illustration: flat vector shapes, clear visual hierarchy, simple icons, labeled sections, arrows and connectors, minimal text placeholders, balanced layout, and a cohesive limited color palette — like a polished editorial or presentation graphic',
  },
  {
    id: 'simple-shapes',
    name: 'Simple Shapes',
    emoji: '⬡',
    prompt: 'a minimalist illustration built from simple geometric shapes — circles, rectangles, triangles, and smooth curves — with flat solid colors, clean edges, and no texture or shading, like modern icon-style or Bauhaus-inspired graphic design',
  },
  {
    id: 'sketchnote',
    name: 'Sketchnote',
    emoji: '🗒️',
    prompt: 'a clean black-marker sketchnote / visual-note-taking illustration on a plain white background: bold confident black outline linework, simple stick-figure people with circle heads, minimalist doodle icons, hand-drawn boxes, arrows and connectors linking ideas, circled numbered step markers, and neat hand-lettered text labels integrated directly into the diagram — in the style of graphic recording / visual thinking notes, mostly monochrome with at most one small color accent',
  },
]

export const DEFAULT_STYLE_ID = STYLES[0].id
