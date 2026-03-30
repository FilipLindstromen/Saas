const CONTAINER_ID = 'reelrecorder-animated-img-canvas-helpers'

/**
 * Browsers (notably Chrome) skip decoding animated GIF/WebP frames for images that are
 * far off-screen; canvas.drawImage then stays on frame 0. Keep decoders warm by parking
 * helper img elements in a tiny in-viewport corner. Inspector thumbnails work because they
 * are normally laid out on screen.
 */
export function getOrCreateAnimatedImageHelperContainer(): HTMLDivElement {
  let el = document.getElementById(CONTAINER_ID) as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = CONTAINER_ID
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = [
      'position:fixed',
      'right:0',
      'bottom:0',
      'max-width:min(160px,100vw)',
      'max-height:min(48px,30vh)',
      'opacity:0.02',
      'pointer-events:none',
      'z-index:2147483646',
      'overflow:hidden',
      'display:flex',
      'flex-wrap:wrap',
      'align-content:flex-end',
      'gap:0',
    ].join(';')
    document.body.appendChild(el)
  }
  return el
}

/** Call before setting `src`. Appends into the helper container when needed. */
export function attachImageForAnimatedCanvasDraw(img: HTMLImageElement): void {
  img.crossOrigin = 'anonymous'
  img.style.width = '1px'
  img.style.height = '1px'
  img.style.objectFit = 'cover'
  img.style.flexShrink = '0'
  img.style.display = 'block'
  const container = getOrCreateAnimatedImageHelperContainer()
  if (img.parentElement !== container) {
    container.appendChild(img)
  }
}
