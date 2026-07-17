import { exportSlidesAsImages, buildInstagramCaption } from '../utils/exportSlidesAsPng'
import { getSlidePlainText } from '../utils/slidePlainText'
import { CAROUSEL_FORMAT } from '../utils/slideFormats'

function sanitizeFilename(name) {
  return (name || 'carousel').trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'carousel'
}

export async function exportCreatorKit({
  slides,
  settings,
  projectName,
  caption = '',
  hashtags = '',
  firstComment = '',
  altTextsById = {},
  onProgress,
  platforms = ['instagram', 'linkedin', 'tiktok'],
}) {
  const exportSlides = slides.filter((s) => (s.layout || 'default') !== 'section')
  const fullCaption = buildInstagramCaption({ caption, hashtags })

  const altLines = exportSlides.map((slide, i) => {
    const alt = (altTextsById[slide.id] || getSlidePlainText(slide)).trim().slice(0, 120)
    return `Slide ${i + 1}: ${alt || '(no alt text)'}`
  }).join('\n')

  const readme = [
    'Carousel Creator Kit',
    '====================',
    '',
    'Contents:',
    '- images/ — numbered carousel images (1080×1440)',
    '- caption.txt — Instagram/LinkedIn post caption',
    '- hashtags.txt — suggested hashtags',
    '- alt-text.txt — per-slide alt text',
    '- posting-guide.txt — platform-specific upload notes',
    firstComment.trim() ? '- first-comment.txt — engagement comment to post after publishing' : '',
    '',
    `Project: ${projectName || 'Untitled'}`,
    `Slides: ${exportSlides.length}`,
    `Exported: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n')

  const postingGuide = [
    'Instagram',
    '---------',
    'Create → Post → Select multiple → add images in order (01, 02, …).',
    'Paste caption.txt. Optionally use first-comment.txt after posting.',
    '',
    'LinkedIn',
    '--------',
    'Create post → Add document OR upload images as a carousel-style post.',
    'Use caption.txt (LinkedIn allows long-form). First line = hook.',
    '',
    'TikTok',
    '------',
    'Create → Photo mode → upload images in order.',
    'Paste caption.txt (keep under character limit).',
    '',
    platforms.includes('meta') ? 'Meta Ads: use Export carousel to Meta in the app.' : '',
  ].filter(Boolean).join('\n')

  const zipExtras = {
    'caption.txt': fullCaption,
    'hashtags.txt': hashtags.trim(),
    'alt-text.txt': altLines,
    'README.txt': readme,
    'posting-guide.txt': postingGuide,
  }
  if (firstComment.trim()) zipExtras['first-comment.txt'] = firstComment.trim()

  await exportSlidesAsImages({
    slides,
    settings: { ...settings, slideFormat: CAROUSEL_FORMAT },
    slideFormat: CAROUSEL_FORMAT,
    projectName,
    onProgress,
    mimeType: 'image/jpeg',
    jpegQuality: 0.92,
    filterSlide: (s) => (s.layout || 'default') !== 'section',
    filenameForIndex: (i) => `images/${String(i + 1).padStart(2, '0')}.jpg`,
    zipExtras,
    zipFilename: `${sanitizeFilename(projectName)}-creator-kit.zip`,
  })
}

export async function exportLinkedInPdf({
  slides,
  settings,
  projectName,
  onProgress,
}) {
  // LinkedIn document posts accept PDF — render slides as images in a simple multi-page PDF via print
  // Fallback: export as numbered JPEGs in linkedin/ folder inside creator kit pattern
  await exportSlidesAsImages({
    slides,
    settings: { ...settings, slideFormat: CAROUSEL_FORMAT },
    slideFormat: CAROUSEL_FORMAT,
    projectName,
    onProgress,
    mimeType: 'image/jpeg',
    jpegQuality: 0.95,
    filterSlide: (s) => (s.layout || 'default') !== 'section',
    filenameForIndex: (i) => `linkedin-${String(i + 1).padStart(2, '0')}.jpg`,
    zipExtras: {
      'README.txt': [
        'LinkedIn carousel export',
        'Upload images in order as a document-style post, or use LinkedIn\'s multi-image post.',
        'Dimensions: 1080×1440 px per slide.',
      ].join('\n'),
    },
    zipFilename: `${sanitizeFilename(projectName)}-linkedin.zip`,
  })
}
