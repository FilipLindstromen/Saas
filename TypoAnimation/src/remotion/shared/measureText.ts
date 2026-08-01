import { stripInlineHighlightMarkup } from '@/lib/inlineHighlight';

// Real glyph-width text measurement via a scratch <canvas> — used where an actual pixel width
// is needed (not the char-count guess StatementScene uses), since kerning/glyph widths vary
// enough per character that "same char count" doesn't mean "same rendered width". Safe to call
// from any scene component: Remotion delays rendering every frame until @remotion/google-fonts'
// loadFont() calls (fonts.ts, module-scope) resolve, so the font used here is already loaded
// both in the live Player and in the headless-Chrome export render.
let scratchCtx: CanvasRenderingContext2D | null = null;

function getScratchCtx(): CanvasRenderingContext2D {
  if (!scratchCtx) {
    scratchCtx = document.createElement('canvas').getContext('2d');
  }
  return scratchCtx as CanvasRenderingContext2D;
}

const REF_SIZE = 100;

// The font size that makes `text` render at exactly `targetWidth` px in `fontFamily`/`fontWeight`
// — solved from a measurement at a fixed reference size, then clamped to stay legible.
export function fitFontSizeToWidth(
  text: string,
  targetWidth: number,
  fontFamily: string,
  fontWeight: number | string,
  opts: { min?: number; max?: number } = {}
): number {
  const { min = 28, max = 240 } = opts;
  const ctx = getScratchCtx();
  ctx.font = `${fontWeight} ${REF_SIZE}px ${fontFamily}`;
  const plain = stripInlineHighlightMarkup(text).trim() || ' ';
  const measured = ctx.measureText(plain).width || 1;
  return Math.min(max, Math.max(min, REF_SIZE * (targetWidth / measured)));
}
