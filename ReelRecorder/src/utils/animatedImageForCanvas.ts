const CONTAINER_ID = 'reelrecorder-animated-img-canvas-helpers'

/**
 * Use crossOrigin="anonymous" only when we need a CORS-clean canvas for remote *non-GIF* bitmaps.
 * Chrome often stops advancing animated GIF frames when the backing img was loaded in
 * CORS mode (crossOrigin set), so GIPHY / *.gif URLs must omit it for preview + export draws.
 */
export function useAnonymousCrossOriginForOverlaySrc(src: string): boolean {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false
  if (!src.startsWith('http://') && !src.startsWith('https://')) return false
  const lower = src.toLowerCase()
  const path = lower.split('?')[0]
  if (lower.includes('giphy.com')) return false
  if (path.endsWith('.gif')) return false
  return true
}

/** Keep CORS policy in sync when reusing the same img element with a new src. */
export function configureOverlayImageCrossOrigin(img: HTMLImageElement, src: string): void {
  if (useAnonymousCrossOriginForOverlaySrc(src)) {
    img.crossOrigin = 'anonymous'
  } else {
    img.removeAttribute('crossorigin')
  }
}

/**
 * Browsers (notably Chrome) skip decoding animated GIF/WebP frames for images that are
 * far off-screen; canvas.drawImage then stays on frame 0. Keep decoders warm by parking
 * helper img elements in a tiny in-viewport corner (opaque — very low opacity can pause GIFs).
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
      'width:6px',
      'height:6px',
      'opacity:1',
      'pointer-events:none',
      'z-index:2147483646',
      'overflow:hidden',
      'display:flex',
      'flex-wrap:wrap',
      'align-content:flex-end',
      'gap:0',
      'background:transparent',
    ].join(';')
    document.body.appendChild(el)
  }
  return el
}

/** Call before setting `src`. Appends into the helper container when needed. */
export function attachImageForAnimatedCanvasDraw(img: HTMLImageElement, src: string): void {
  configureOverlayImageCrossOrigin(img, src)
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
