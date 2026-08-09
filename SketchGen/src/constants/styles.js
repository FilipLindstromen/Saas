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
  {
    id: 'web-design',
    name: 'Web Design',
    emoji: '🌐',
    prompt: 'a modern clean web design mockup illustration: polished UI layout with generous whitespace, subtle shadows, rounded cards, clear typography hierarchy, hero section, navigation bar, feature grids, and cohesive SaaS-style color accents — flat-to-soft-3D vector look suitable for landing pages and product marketing, crisp readable text placeholders, and balanced responsive-style composition',
  },
  {
    id: 'oatly-graphics',
    name: 'Oatly Graphics',
    emoji: '🥛',
    prompt: 'Oatly-inspired brand graphics: flat dusty sky-blue background, solid black and white only for all artwork (no gradients). Chunky hand-drawn/stamped typography — bold uneven all-caps titles, playful scripts, and text shaped into banners or simple objects ("written illustrations"). Flat black silhouette icons with slightly rough woodcut/stamp edges (trucks, gears, cartons, hands, arrows). Thin white dotted lines connecting steps in horizontal process flows. Whimsical DIY collage feel — informal, witty, anti-corporate — generous negative space, thick irregular outlines, minimal detail, no photorealism. Suitable for infographics, how-it-works diagrams, and packaging-style callouts',
  },
  {
    id: 'playful-editorial',
    name: 'Playful Editorial',
    emoji: '🙃',
    prompt: 'a playful editorial infographic design with bold flat vector illustrations, expressive geometric cartoon characters, quirky hand-drawn faces, chunky typography, colorful color-blocked sections, simple visual metaphors, clean diagrams, modern retro poster aesthetics, slightly naive illustration, high visual personality, minimal shading, sophisticated composition, friendly but not childish. Avoid corporate SaaS illustration, generic wellness aesthetics, photorealism, clinical medical illustrations, excessive gradients, and overly polished 3D graphics',
  },
  {
    id: 'playful-web-infographic',
    name: 'Playful Web Infographic',
    emoji: '📱',
    prompt: 'a long-form vertical mobile landing-page / advertorial infographic layout, stacked into bold full-bleed color-blocked sections (saturated red, black, cream, orange, green, blue). A recurring simple flat cartoon mascot character — big white oval eyes with black pupils and a minimal expressive mouth shape — appears throughout to carry emotion and continuity. Chunky rounded bold sans-serif headlines in all caps, short punchy body copy, and clear typographic hierarchy. Numbered circular step badges connected by arrows in simple process-loop diagrams, paired icon-circle-plus-label explainer rows, and two-column comparison blocks (problem vs. solution). Rounded rectangle call-to-action buttons and a small shield/badge icon for a guarantee callout near the bottom. Flat vector shapes only, no gradients, no photorealism, high color contrast, generous padding, and a clean aligned grid — direct-response marketing / advertorial infographic aesthetic, friendly and energetic but professionally composed',
  },
]

export const DEFAULT_STYLE_ID = STYLES[0].id
