import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import Slide from '../components/Slide'
import { getExportCanvasSize } from './slideFormats'

export { getExportCanvasSize } from './slideFormats'

export function buildSlideExportProps(settings) {
  return {
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    fontFamily: settings.fontFamily,
    defaultTextSize: settings.defaultTextSize,
    h1Size: settings.h1Size,
    h2Size: settings.h2Size,
    h3Size: settings.h3Size,
    h1FontFamily: settings.h1FontFamily,
    h2FontFamily: settings.h2FontFamily,
    h3FontFamily: settings.h3FontFamily,
    textDropShadow: settings.textDropShadow,
    shadowBlur: settings.shadowBlur,
    shadowOffsetX: settings.shadowOffsetX,
    shadowOffsetY: settings.shadowOffsetY,
    shadowColor: settings.shadowColor,
    textOutline: settings.textOutline,
    outlineWidth: settings.outlineWidth,
    outlineColor: settings.outlineColor,
    textInlineBackground: settings.textInlineBackground,
    inlineBgColor: settings.inlineBgColor,
    inlineBgOpacity: settings.inlineBgOpacity,
    inlineBgPadding: settings.inlineBgPadding,
    lineHeight: settings.lineHeight ?? 1,
    bulletLineHeight: settings.bulletLineHeight ?? 1,
    bulletTextSize: settings.bulletTextSize ?? 3,
    bulletGap: settings.bulletGap ?? 0.5,
    bulletStyle: settings.bulletStyle || 'dot',
    contentBottomOffset: settings.contentBottomOffset ?? 12,
    contentEdgeOffset: settings.contentEdgeOffset ?? 9,
    contentVerticalAlign: settings.contentVerticalAlign ?? 'bottom',
    showBullets: settings.showBullets !== false,
    defaultFontWeight: settings.defaultFontWeight ?? 700,
    h1Weight: settings.h1Weight ?? 700,
    h2Weight: settings.h2Weight ?? 700,
    h3Weight: settings.h3Weight ?? 700,
    h1LineHeight: settings.h1LineHeight ?? 1.2,
    h2LineHeight: settings.h2LineHeight ?? 1.2,
    h3LineHeight: settings.h3LineHeight ?? 1.2,
    textStyleMode: settings.textStyleMode || 'standard',
    fontPairingSerifFont: settings.fontPairingSerifFont || 'Playfair Display',
    kenBurns: false,
    webcamEnabled: false,
    previewTextAnimation: false,
    textAnimation: 'none',
  }
}

function waitForMedia(container) {
  const images = [...container.querySelectorAll('img')]
  const videos = [...container.querySelectorAll('video')]
  const waits = [
    ...images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
      })
    }),
    ...videos.map((video) => {
      if (video.readyState >= 2) {
        try { video.pause() } catch (_) {}
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        const done = () => {
          try { video.pause() } catch (_) {}
          resolve()
        }
        video.addEventListener('loadeddata', done, { once: true })
        video.addEventListener('error', done, { once: true })
      })
    }),
  ]
  return Promise.all(waits)
}

function sanitizeFilename(name) {
  return (name || 'presentation').trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'presentation'
}

async function captureSlideCanvas(slideEl, size) {
  return html2canvas(slideEl, {
    width: size.w,
    height: size.h,
    scale: 1,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: null,
  })
}

async function canvasToBlob(canvas, mimeType, jpegQuality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, mimeType === 'image/jpeg' ? jpegQuality : undefined)
  })
}

/**
 * Render slides off-screen and download as a ZIP archive.
 */
export async function exportSlidesAsImages({
  slides,
  settings,
  slideFormat,
  projectName,
  onProgress,
  filenameForIndex = (i) => `slide-${String(i + 1).padStart(2, '0')}.png`,
  mimeType = 'image/png',
  jpegQuality = 0.92,
  zipExtras = {},
  zipFilename,
  filterSlide = () => true,
}) {
  const exportSlides = slides.filter(filterSlide)
  if (!exportSlides.length) {
    throw new Error('No slides to export')
  }

  const size = getExportCanvasSize(slideFormat)
  const slideProps = buildSlideExportProps(settings)
  const zip = new JSZip()

  Object.entries(zipExtras).forEach(([name, content]) => {
    if (content != null && content !== '') zip.file(name, content)
  })

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;visibility:hidden;z-index:-1;'
  document.body.appendChild(container)

  const mount = document.createElement('div')
  mount.style.width = `${size.w}px`
  mount.style.height = `${size.h}px`
  mount.style.overflow = 'hidden'
  container.appendChild(mount)

  const root = createRoot(mount)

  try {
    await document.fonts.ready

    for (let i = 0; i < exportSlides.length; i++) {
      const slide = exportSlides[i]
      onProgress?.(`Exporting slide ${i + 1} of ${exportSlides.length}…`)

      root.render(
        <div
          className="png-export-wrap"
          style={{ width: size.w, height: size.h, overflow: 'hidden', background: settings.backgroundColor || '#1a1a1a' }}
        >
          <Slide
            slide={slide}
            {...slideProps}
            slideFormat={slideFormat}
          />
        </div>
      )

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await waitForMedia(mount)
      await new Promise((resolve) => setTimeout(resolve, 350))

      const slideEl = mount.querySelector('.slide')
      if (!slideEl) continue

      slideEl.style.width = `${size.w}px`
      slideEl.style.height = `${size.h}px`
      slideEl.style.maxWidth = 'none'
      slideEl.style.aspectRatio = 'unset'

      const canvas = await captureSlideCanvas(slideEl, size)
      const blob = await canvasToBlob(canvas, mimeType, jpegQuality)
      if (!blob) continue

      zip.file(filenameForIndex(i), blob)
    }

    onProgress?.('Creating ZIP…')
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const filename = zipFilename || `${sanitizeFilename(projectName)}-slides.zip`
    const url = URL.createObjectURL(zipBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } finally {
    root.unmount()
    document.body.removeChild(container)
  }
}

/** @deprecated Use exportSlidesAsImages */
export async function exportSlidesAsPng(opts) {
  return exportSlidesAsImages(opts)
}

export function buildInstagramCaption({ caption, hashtags }) {
  const parts = [(caption || '').trim()]
  const tags = (hashtags || '').trim()
  if (tags) {
    parts.push(tags.startsWith('#') ? tags : tags.split(/\s+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' '))
  }
  return parts.filter(Boolean).join('\n\n')
}

export async function exportInstagramCarousel({
  slides,
  settings,
  projectName,
  onProgress,
  caption = '',
  hashtags = '',
  firstComment = '',
  altTexts = [],
  skipSectionSlides = true,
  imageFormat = 'jpeg',
  jpegQuality = 0.92,
}) {
  const ext = imageFormat === 'png' ? 'png' : 'jpg'
  const mimeType = imageFormat === 'png' ? 'image/png' : 'image/jpeg'
  const exportSlides = slides.filter((s) => !skipSectionSlides || (s.layout || 'default') !== 'section')

  const fullCaption = buildInstagramCaption({ caption, hashtags })
  const altLines = exportSlides.map((slide, i) => {
    const alt = (altTexts[i] || '').trim()
    return `Slide ${i + 1}: ${alt || '(no alt text)'}`
  }).join('\n')

  const readme = [
    'Instagram carousel export',
    '=======================',
    '',
    '1. Open Instagram → Create → Post → Select multiple.',
    `2. Add images in order (${String(exportSlides.length).padStart(2, '0')} files, numbered 01–${String(exportSlides.length).padStart(2, '0')}).`,
    '3. Paste the caption from caption.txt into the post caption field.',
    firstComment.trim() ? '4. After posting, add the first comment from first-comment.txt.' : '',
    '5. Optionally set alt text per image using alt-text.txt while editing the post.',
    '',
    `Dimensions: 1080×1440 px (${exportSlides.length} slide${exportSlides.length === 1 ? '' : 's'})`,
  ].filter(Boolean).join('\n')

  const zipExtras = {
    'caption.txt': fullCaption,
    'alt-text.txt': altLines,
    'README.txt': readme,
  }
  if (firstComment.trim()) {
    zipExtras['first-comment.txt'] = firstComment.trim()
  }

  return exportSlidesAsImages({
    slides,
    settings,
    slideFormat: '3:4',
    projectName,
    onProgress,
    mimeType,
    jpegQuality,
    filterSlide: (s) => !skipSectionSlides || (s.layout || 'default') !== 'section',
    filenameForIndex: (i) => `${String(i + 1).padStart(2, '0')}.${ext}`,
    zipExtras,
    zipFilename: `${sanitizeFilename(projectName)}-instagram-carousel.zip`,
  })
}
